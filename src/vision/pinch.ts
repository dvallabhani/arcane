/** MediaPipe hand landmark indices we use (there are 21 in total). */
export const LANDMARK = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5, // knuckle at the base of the index finger
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  PINKY_MCP: 17,
} as const

export interface Point3 {
  x: number
  y: number
  z: number
}

function dist3(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/**
 * How "closed" the pinch is, independent of how big the hand looks.
 *
 * raw thumb-index distance / hand size
 *
 * Hand size is the larger of palm length (wrist -> middle knuckle) and palm
 * width (index knuckle -> pinky knuckle). Taking the larger one keeps the
 * measurement stable when the hand tilts and one of the two gets
 * foreshortened. Roughly: open hand ≈ 0.8–1.5, pinch ≈ 0.05–0.3.
 */
export function pinchRatio(points: readonly Point3[]): number {
  const pinchDistance = dist3(points[LANDMARK.THUMB_TIP], points[LANDMARK.INDEX_TIP])
  const palmLength = dist3(points[LANDMARK.WRIST], points[LANDMARK.MIDDLE_MCP])
  const palmWidth = dist3(points[LANDMARK.INDEX_MCP], points[LANDMARK.PINKY_MCP])
  const handSize = Math.max(palmLength, palmWidth, 1e-6)
  return pinchDistance / handSize
}

export interface PinchConfig {
  /** Start pinching when the ratio drops below this... */
  engage: number
  /** ...and only stop once it rises above this (hysteresis band). */
  release: number
  /** The new state must hold for this many consecutive frames before switching. */
  confirmFrames: number
}

export const DEFAULT_PINCH: PinchConfig = { engage: 0.3, release: 0.45, confirmFrames: 2 }

/**
 * Turns a noisy ratio into a stable on/off signal.
 *
 * With a single threshold, a ratio hovering around it would flip on/off every
 * frame and the crystal would be dropped and re-grabbed constantly. Two
 * thresholds (a "hysteresis band") plus a short confirmation count fix that.
 */
export class PinchDetector {
  pinching = false
  private pendingFrames = 0
  private readonly config: PinchConfig

  constructor(config: PinchConfig = DEFAULT_PINCH) {
    this.config = config
  }

  update(ratio: number): boolean {
    const wantsToSwitch = this.pinching ? ratio > this.config.release : ratio < this.config.engage
    if (wantsToSwitch) {
      this.pendingFrames++
      if (this.pendingFrames >= this.config.confirmFrames) {
        this.pinching = !this.pinching
        this.pendingFrames = 0
      }
    } else {
      this.pendingFrames = 0
    }
    return this.pinching
  }

  reset(): void {
    this.pinching = false
    this.pendingFrames = 0
  }
}
