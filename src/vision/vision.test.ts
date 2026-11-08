import { describe, expect, it } from 'vitest'
import { describeCameraError } from './cameraErrors'
import { GestureInterpreter } from './gestureInterpreter'
import { landmarkToNdc } from './mapping'
import { OneEuroFilter } from './oneEuroFilter'
import { LANDMARK, PinchDetector, pinchRatio, type Point3 } from './pinch'

/**
 * Builds a fake 21-point hand. Only the landmarks we actually use are placed
 * meaningfully; palm length (wrist -> middle knuckle) is 0.2.
 */
function fakeHand(indexTip: { x: number; y: number }, thumbTip: { x: number; y: number }, scale = 1): Point3[] {
  const pts: Point3[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7, z: 0 }))
  const at = (x: number, y: number) => ({ x: 0.5 + (x - 0.5) * scale, y: 0.7 + (y - 0.7) * scale, z: 0 })
  pts[LANDMARK.WRIST] = at(0.5, 0.8)
  pts[LANDMARK.MIDDLE_MCP] = at(0.5, 0.6)
  pts[LANDMARK.INDEX_MCP] = at(0.45, 0.62)
  pts[LANDMARK.PINKY_MCP] = at(0.58, 0.64)
  pts[LANDMARK.INDEX_TIP] = at(indexTip.x, indexTip.y)
  pts[LANDMARK.THUMB_TIP] = at(thumbTip.x, thumbTip.y)
  return pts
}
const OPEN = fakeHand({ x: 0.45, y: 0.4 }, { x: 0.33, y: 0.6 })
const PINCHED = fakeHand({ x: 0.4, y: 0.5 }, { x: 0.41, y: 0.51 })

/** Compare 2D points allowing for floating-point rounding. */
function expectNear(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 9)
  expect(actual.y).toBeCloseTo(expected.y, 9)
}

describe('landmarkToNdc', () => {
  it('maps the centre of the camera image to the centre of the screen', () => {
    expectNear(landmarkToNdc({ x: 0.5, y: 0.5 }), { x: 0, y: 0 })
  })

  it('mirrors horizontally: a hand on the image left is on the screen right', () => {
    // In the raw (unmirrored) camera image, the user's right side is image-left.
    expect(landmarkToNdc({ x: 0.2, y: 0.5 }).x).toBeGreaterThan(0)
  })

  it('flips y so that raising your hand moves the cursor up', () => {
    expect(landmarkToNdc({ x: 0.5, y: 0.2 }).y).toBeGreaterThan(0)
  })

  it('reaches the screen edge before the hand reaches the frame edge, then clamps', () => {
    expectNear(landmarkToNdc({ x: 0.85, y: 0.85 }), { x: -1, y: -1 })
    expectNear(landmarkToNdc({ x: 1, y: 1 }), { x: -1, y: -1 })
    expectNear(landmarkToNdc({ x: 0.15, y: 0.15 }), { x: 1, y: 1 })
  })
})

describe('pinchRatio', () => {
  it('is large for an open hand and small for a pinch', () => {
    expect(pinchRatio(OPEN)).toBeGreaterThan(0.6)
    expect(pinchRatio(PINCHED)).toBeLessThan(0.15)
  })

  it('does not depend on how far the hand is from the camera', () => {
    const near = fakeHand({ x: 0.45, y: 0.4 }, { x: 0.33, y: 0.6 }, 1.5)
    const far = fakeHand({ x: 0.45, y: 0.4 }, { x: 0.33, y: 0.6 }, 0.5)
    expect(pinchRatio(near)).toBeCloseTo(pinchRatio(far), 6)
  })
})

describe('PinchDetector', () => {
  it('needs the ratio below the engage threshold for 2 frames', () => {
    const p = new PinchDetector()
    expect(p.update(0.1)).toBe(false)
    expect(p.update(0.1)).toBe(true)
  })

  it('ignores a single noisy frame', () => {
    const p = new PinchDetector()
    p.update(0.1)
    p.update(0.9)
    expect(p.update(0.1)).toBe(false)
  })

  it('stays pinched inside the hysteresis band', () => {
    const p = new PinchDetector()
    p.update(0.1)
    p.update(0.1)
    for (let i = 0; i < 10; i++) expect(p.update(0.38)).toBe(true) // between 0.30 and 0.45
  })

  it('releases once the ratio stays above the release threshold', () => {
    const p = new PinchDetector()
    p.update(0.1)
    p.update(0.1)
    p.update(0.6)
    expect(p.update(0.6)).toBe(false)
  })

  it('does not chatter when the ratio oscillates around one threshold', () => {
    const p = new PinchDetector()
    let switches = 0
    let prev = false
    for (let i = 0; i < 100; i++) {
      const now = p.update(i % 2 === 0 ? 0.29 : 0.31)
      if (now !== prev) switches++
      prev = now
    }
    expect(switches).toBeLessThanOrEqual(1)
  })
})

describe('OneEuroFilter', () => {
  it('passes the first sample through unchanged', () => {
    expect(new OneEuroFilter().filter(0.7, 0)).toBe(0.7)
  })

  it('reduces jitter on a stationary signal', () => {
    const f = new OneEuroFilter()
    let maxDeviation = 0
    for (let i = 0; i < 120; i++) {
      const noisy = 0.5 + (i % 2 === 0 ? 0.02 : -0.02)
      const out = f.filter(noisy, i / 30)
      if (i > 10) maxDeviation = Math.max(maxDeviation, Math.abs(out - 0.5))
    }
    expect(maxDeviation).toBeLessThan(0.01) // input jitter was ±0.02
  })

  it('catches up with a fast, steady movement', () => {
    const f = new OneEuroFilter()
    let out = 0
    for (let i = 0; i <= 30; i++) out = f.filter(i * 0.05, i / 30) // 1.5 units/second
    expect(Math.abs(out - 1.5)).toBeLessThan(0.15)
  })
})

describe('GestureInterpreter', () => {
  it('reports no hand until landmarks arrive', () => {
    const g = new GestureInterpreter()
    const f = g.process(null, null, 0)
    expect(f.handVisible).toBe(false)
    expect(f.ndc).toBeNull()
  })

  it('tracks the index fingertip and detects a pinch', () => {
    const g = new GestureInterpreter()
    let f = g.process(OPEN, null, 0)
    expect(f.handVisible).toBe(true)
    expect(f.grip).toBe(false)
    expect(f.ndc).not.toBeNull()
    g.process(PINCHED, null, 33)
    f = g.process(PINCHED, null, 66)
    expect(f.pinching).toBe(true)
    expect(f.grip).toBe(true)
  })

  it('survives a brief detection dropout without losing the hand', () => {
    const g = new GestureInterpreter()
    g.process(PINCHED, null, 0)
    g.process(PINCHED, null, 33)
    const f = g.process(null, null, 66)
    expect(f.handVisible).toBe(true)
    expect(f.grip).toBe(true)
  })

  it('declares the hand lost (and releases the grip) after several empty frames', () => {
    const g = new GestureInterpreter()
    g.process(PINCHED, null, 0)
    g.process(PINCHED, null, 33)
    let f = g.process(PINCHED, null, 66)
    for (let i = 0; i < 4; i++) f = g.process(null, null, 100 + i * 33)
    expect(f.handVisible).toBe(false)
    expect(f.grip).toBe(false)
    expect(f.ndc).toBeNull()
  })

  it('resumes tracking after the hand returns', () => {
    const g = new GestureInterpreter()
    for (let i = 0; i < 5; i++) g.process(null, null, i * 33)
    const f = g.process(OPEN, null, 200)
    expect(f.handVisible).toBe(true)
  })

  it('prefers world landmarks for the pinch measurement when provided', () => {
    const g = new GestureInterpreter()
    // image says "open", metric 3D says "pinched": the 3D estimate wins
    g.process(OPEN, PINCHED, 0)
    expect(g.process(OPEN, PINCHED, 33).pinching).toBe(true)
  })
})

describe('describeCameraError', () => {
  const err = (name: string) => new DOMException('x', name)
  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'no-camera'],
    ['OverconstrainedError', 'no-camera'],
    ['NotReadableError', 'in-use'],
    ['InsecureContextError', 'insecure'],
    ['SomethingElse', 'unknown'],
  ])('%s -> %s', (name, kind) => {
    expect(describeCameraError(err(name)).kind).toBe(kind)
  })
})
