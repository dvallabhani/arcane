import { Vector3 } from 'three'
import { CRYSTAL_START, SOCKET } from './constants'
import { crystal, cursorWorld, sceneLink } from './session'
import { gameStore } from './store'

/**
 * A small read-only window into the game for automated browser tests
 * (see /e2e). It lets a test find where the crystal and pedestal are drawn on
 * screen so it can drive the real mouse to them. It cannot change game state.
 */
export interface ArcaneTestHooks {
  crystal(): { state: string; x: number; y: number }
  cursor(): { visible: boolean; x: number; y: number }
  state(): ReturnType<typeof gameStore.get>
  worldToScreen(x: number, y: number): { x: number; y: number } | null
  points: { start: { x: number; y: number }; socket: { x: number; y: number } }
}

export function installTestHooks(): void {
  const hooks: ArcaneTestHooks = {
    crystal: () => ({ state: crystal.state, x: crystal.position.x, y: crystal.position.y }),
    cursor: () => ({ ...cursorWorld }),
    state: () => gameStore.get(),
    worldToScreen(x, y) {
      const camera = sceneLink.camera
      const stage = document.querySelector('[data-testid="stage"]')
      if (!camera || !stage) return null
      const v = new Vector3(x, y, 0).project(camera)
      const rect = stage.getBoundingClientRect()
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height }
    },
    points: { start: { ...CRYSTAL_START }, socket: { ...SOCKET } },
  }
  ;(window as unknown as { __arcane: ArcaneTestHooks }).__arcane = hooks
}
