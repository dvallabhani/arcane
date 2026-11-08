import type { Vec2 } from '../game/math'
import { DEFAULT_MAPPING, landmarkToNdc, type MappingOptions } from './mapping'
import { OneEuroFilter } from './oneEuroFilter'
import { DEFAULT_PINCH, LANDMARK, PinchDetector, pinchRatio, type PinchConfig, type Point3 } from './pinch'

export interface GestureFrame {
  /** Smoothed cursor position in NDC, or null if no hand is being tracked. */
  ndc: Vec2 | null
  /** true while a stable pinch is held. */
  grip: boolean
  handVisible: boolean
  pinching: boolean
  ratio: number | null
}

export interface InterpreterOptions {
  mapping: MappingOptions
  pinch: PinchConfig
  /**
   * The detector occasionally misses a single frame. We only treat the hand as
   * gone after this many consecutive empty frames, so a one-frame dropout
   * doesn't drop the crystal.
   */
  lostAfterFrames: number
}

export const DEFAULT_INTERPRETER: InterpreterOptions = {
  mapping: DEFAULT_MAPPING,
  pinch: DEFAULT_PINCH,
  lostAfterFrames: 4,
}

const NO_HAND: GestureFrame = { ndc: null, grip: false, handVisible: false, pinching: false, ratio: null }

/**
 * Converts raw MediaPipe output (one frame at a time) into game input.
 * Contains no browser APIs, so it is fully unit-testable with fake landmarks.
 */
export class GestureInterpreter {
  private readonly options: InterpreterOptions
  private readonly filterX = new OneEuroFilter()
  private readonly filterY = new OneEuroFilter()
  private readonly pinch: PinchDetector
  private missingFrames = Number.POSITIVE_INFINITY
  private last: GestureFrame = NO_HAND

  constructor(options: InterpreterOptions = DEFAULT_INTERPRETER) {
    this.options = options
    this.pinch = new PinchDetector(options.pinch)
  }

  /**
   * @param landmarks  21 normalized image landmarks (x, y in [0,1]) or null if no hand
   * @param worldLandmarks  21 landmarks in metres (MediaPipe's 3D estimate), if available
   * @param timeMs  timestamp of the camera frame
   */
  process(landmarks: readonly Point3[] | null, worldLandmarks: readonly Point3[] | null, timeMs: number): GestureFrame {
    if (!landmarks || landmarks.length < 21) {
      this.missingFrames++
      if (this.missingFrames >= this.options.lostAfterFrames) {
        this.resetTracking()
        this.last = NO_HAND
      }
      return this.last
    }
    this.missingFrames = 0

    // Cursor: index fingertip, mirrored and mapped to screen space, then smoothed.
    const raw = landmarkToNdc(landmarks[LANDMARK.INDEX_TIP], this.options.mapping)
    const t = timeMs / 1000
    const ndc = { x: this.filterX.filter(raw.x, t), y: this.filterY.filter(raw.y, t) }

    // Pinch: prefer the metric 3D landmarks, which don't change with camera
    // distance or hand rotation; fall back to the image landmarks.
    const points = worldLandmarks && worldLandmarks.length >= 21 ? worldLandmarks : landmarks
    const ratio = pinchRatio(points)
    const pinching = this.pinch.update(ratio)

    this.last = { ndc, grip: pinching, handVisible: true, pinching, ratio }
    return this.last
  }

  resetTracking(): void {
    this.filterX.reset()
    this.filterY.reset()
    this.pinch.reset()
  }
}
