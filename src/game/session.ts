import type { Camera } from 'three'
import { CrystalInteraction } from './interaction'
import { createPointerInput } from './input'
import { gameStore, type ControlMode } from './store'

/*
 * The live game objects. There is exactly one of each, so they are simple
 * module-level singletons (like globals in a C++ program). Per-frame data
 * lives here instead of in React state so that 60 fps updates don't cause
 * 60 React re-renders per second.
 */
export const crystal = new CrystalInteraction()
export const pointerInput = createPointerInput()

/** Where the cursor currently is in the 3D world (written by the scene each frame). */
export const cursorWorld = { visible: false, x: 0, y: 0 }

/** The active 3D camera, so non-React code (tests, tools) can project world points to the screen. */
export const sceneLink: { camera: Camera | null } = { camera: null }

function clearInput(): void {
  pointerInput.ndc = null
  pointerInput.grip = false
  pointerInput.edges.length = 0
}

export function resetGame(): void {
  crystal.reset()
  const s = gameStore.get()
  gameStore.set({ crystal: crystal.state, completed: false, nearSocket: false, resetCount: s.resetCount + 1 })
}

export function startGame(mode: ControlMode): void {
  clearInput()
  resetGame()
  gameStore.set({ screen: 'play', mode, showHowTo: false, cameraError: null })
}

export function switchMode(mode: ControlMode): void {
  clearInput()
  gameStore.set({ mode, cameraError: null })
}

export function returnToMenu(): void {
  clearInput()
  resetGame()
  gameStore.set({ screen: 'title', cameraError: null })
}

export function retryCamera(): void {
  gameStore.set({ cameraError: null, cameraAttempt: gameStore.get().cameraAttempt + 1 })
}
