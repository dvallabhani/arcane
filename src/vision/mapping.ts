import { clamp, type Vec2 } from '../game/math'

export interface MappingOptions {
  /** Webcams show a mirror image. When true, moving your hand right moves the cursor right. */
  mirror: boolean
  /**
   * Fraction of the camera frame ignored on the left/right and top/bottom edges.
   * The remaining "active region" is stretched across the whole screen, so you
   * can reach the screen edges without your hand leaving the camera's view.
   */
  marginX: number
  marginY: number
}

export const DEFAULT_MAPPING: MappingOptions = { mirror: true, marginX: 0.15, marginY: 0.15 }

/**
 * Converts a MediaPipe normalized landmark (x, y in [0, 1], origin top-left of
 * the *unmirrored* camera image) into normalized device coordinates
 * (x, y in [-1, 1], origin at the screen centre, y pointing up).
 */
export function landmarkToNdc(landmark: Vec2, options: MappingOptions = DEFAULT_MAPPING): Vec2 {
  const x = options.mirror ? 1 - landmark.x : landmark.x
  const u = clamp((x - options.marginX) / (1 - 2 * options.marginX), 0, 1)
  const v = clamp((landmark.y - options.marginY) / (1 - 2 * options.marginY), 0, 1)
  return { x: u * 2 - 1, y: -(v * 2 - 1) }
}
