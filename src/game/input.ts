import type { Vec2 } from './math'

/**
 * The shared input "mailbox" between the control layer and the 3D scene.
 *
 * Both control modes write here:
 *  - mouse mode: pointer events convert the mouse position to NDC
 *  - webcam mode: the gesture interpreter converts the index fingertip to NDC
 *
 * The scene reads it every frame, projects `ndc` onto the interaction plane
 * and passes the result to CrystalInteraction. NDC ("normalized device
 * coordinates") run from -1 (left/bottom) to +1 (right/top) across the canvas.
 */
export interface PointerInput {
  ndc: Vec2 | null
  grip: boolean
  /**
   * Presses and releases that happened since the last frame, in order.
   * The scene samples input once per frame, so a click shorter than a frame
   * (fast hardware, a busy laptop, automated tests) would otherwise be missed.
   * The scene replays these edges before the regular per-frame update.
   */
  edges: { ndc: Vec2; grip: boolean }[]
}

export function createPointerInput(): PointerInput {
  return { ndc: null, grip: false, edges: [] }
}
