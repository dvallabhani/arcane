import { Vector3 } from 'three'
import { CRYSTAL_START, SOCKET, WELLS } from './constants'
import type { EnemyKind } from './content'
import { sceneLink, world } from './session'
import { gameStore } from './store'

type Point = { x: number; y: number }

/**
 * A small window into the game for automated browser tests (see /e2e) and
 * manual testing.
 *
 * Always available (read-only): positions of things on screen and a snapshot
 * of the game state, so a test can drive the real mouse to them.
 *
 * Only with `?debug` in the URL: shortcuts that change the game (jump to a
 * wave, set health, spawn a shadow) for testing late-game content quickly.
 */
export interface ArcaneTestHooks {
  state(): ReturnType<typeof gameStore.get>
  world(): {
    phase: string
    wave: number
    hp: number
    score: number
    paused: boolean
    held: string | null
    shards: { id: number; kind: string; state: string; x: number; y: number }[]
    enemies: { id: number; kind: string; x: number; y: number; hp: number }[]
    boss: { x: number; y: number; hp: number; state: string } | null
  }
  worldToScreen(x: number, y: number): Point | null
  points: { start: Point; socket: Point; wells: Point[] }
  debug?: {
    skipToWave(n: number): void
    setHp(hp: number): void
    damageBoss(amount: number): void
    spawn(kind: EnemyKind, x: number, y: number): void
  }
}

export function installTestHooks(): void {
  const hooks: ArcaneTestHooks = {
    state: () => gameStore.get(),
    world: () => ({
      phase: world.phase,
      wave: world.waveIndex + 1,
      hp: world.hp,
      score: world.score,
      paused: world.paused,
      held: world.held?.kind ?? null,
      shards: world.shards.map((s) => ({ id: s.id, kind: s.kind, state: s.state, x: s.x, y: s.y })),
      enemies: world.enemies.map((e) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y, hp: e.hp })),
      boss: world.boss ? { x: world.boss.x, y: world.boss.y, hp: world.boss.hp, state: world.boss.state } : null,
    }),
    worldToScreen(x, y) {
      const camera = sceneLink.camera
      const stage = document.querySelector('[data-testid="stage"]')
      if (!camera || !stage) return null
      const v = new Vector3(x, y, 0).project(camera)
      const rect = stage.getBoundingClientRect()
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height }
    },
    points: { start: { ...CRYSTAL_START }, socket: { ...SOCKET }, wells: WELLS.map((w) => ({ ...w })) },
  }

  if (new URLSearchParams(window.location.search).has('debug')) {
    hooks.debug = {
      skipToWave: (n) => world.debugSkipToWave(n),
      setHp: (hp) => world.debugSetHp(hp),
      damageBoss: (amount) => world.debugDamageBoss(amount),
      spawn: (kind, x, y) => void world.spawnEnemy(kind, 'left', { x, y }),
    }
  }
  ;(window as unknown as { __arcane: ArcaneTestHooks }).__arcane = hooks
}
