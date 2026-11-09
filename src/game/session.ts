import type { Camera } from 'three'
import { sound } from '../audio/sound'
import { WAVES } from './content'
import { createPointerInput } from './input'
import { KEYS, loadNumber, saveNumber } from './storage'
import { gameStore, type ControlMode, type PauseReason } from './store'
import { World, type GameEvent } from './world'

/*
 * The live game objects. There is exactly one of each, so they are simple
 * module-level singletons (like globals in a C++ program). Per-frame data
 * lives here instead of in React state so that 60 fps updates don't cause
 * 60 React re-renders per second.
 */
export const world = new World(Date.now() % 100000)
export const pointerInput = createPointerInput()

/** Where the cursor currently is in the 3D world (written by the scene each frame). */
export const cursorWorld = { visible: false, x: 0, y: 0 }

/** The active 3D camera, so non-React code (tests, tools) can project world points to the screen. */
export const sceneLink: { camera: Camera | null } = { camera: null }

gameStore.set({ best: loadNumber(KEYS.best, 0), muted: loadNumber(KEYS.muted, 0) === 1 })
sound.setMuted(gameStore.get().muted)

function clearInput(): void {
  pointerInput.ndc = null
  pointerInput.grip = false
  pointerInput.edges.length = 0
}

/** Copies what the HUD needs from the world into the UI store (React re-renders only on change). */
export function syncStore(): void {
  const w = world
  const held = w.held
  gameStore.set({
    phase: w.phase,
    wave: w.waveIndex + 1,
    waveName: w.wave.name,
    waveCount: WAVES.length,
    bossWave: !!w.wave.boss,
    hp: Math.max(0, Math.round(w.hp)),
    shielded: w.shieldTime > 0,
    score: w.score,
    multiplier: w.multiplier,
    waveBonus: w.lastWaveBonus,
    bossHp: w.boss && w.boss.state !== 'dying' ? w.boss.hp : 0,
    bossMaxHp: w.boss ? w.boss.maxHp : 0,
    enemies: w.enemies.length,
    held: held ? held.kind : null,
    hovering: w.hoveredId !== null,
    nearSocket: w.nearSocket,
    paused: w.paused,
  })
}

/** Reacts to game events that matter outside the 3D scene (best score). */
export function handleSessionEvents(events: GameEvent[]): void {
  for (const e of events) {
    if (e.type === 'victory' || e.type === 'defeat') {
      const best = gameStore.get().best
      const newBest = e.score > best
      if (newBest) saveNumber(KEYS.best, e.score)
      gameStore.set({ best: Math.max(best, e.score), newBest })
    }
  }
}

export function restartRun(): void {
  clearInput()
  world.reset(Date.now() % 100000)
  gameStore.set({ paused: false, pauseReason: null, newBest: false, runCount: gameStore.get().runCount + 1 })
  syncStore()
}

export function startGame(mode: ControlMode): void {
  sound.unlock() // browsers only allow audio after a click
  restartRun()
  gameStore.set({ screen: 'play', mode, showHowTo: false, cameraError: null })
}

export function switchMode(mode: ControlMode): void {
  clearInput()
  gameStore.set({ mode, cameraError: null })
}

export function returnToMenu(): void {
  clearInput()
  restartRun()
  gameStore.set({ screen: 'title', cameraError: null })
}

export function retryCamera(): void {
  gameStore.set({ cameraError: null, cameraAttempt: gameStore.get().cameraAttempt + 1 })
}

export function pause(reason: PauseReason): void {
  if (world.isOver || world.paused) return
  clearInput()
  world.paused = true
  gameStore.set({ paused: true, pauseReason: reason })
}

export function resume(): void {
  world.paused = false
  gameStore.set({ paused: false, pauseReason: null })
}

export function togglePause(): void {
  if (world.paused) resume()
  else pause('menu')
}

export function toggleMute(): void {
  const muted = !gameStore.get().muted
  sound.setMuted(muted)
  saveNumber(KEYS.muted, muted ? 1 : 0)
  gameStore.set({ muted })
}
