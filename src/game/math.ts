/** A point on the 2D interaction plane (world units). */
export interface Vec2 {
  x: number
  y: number
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Frame-rate independent smoothing: moves `current` toward `target`.
 * `speed` is roughly "how many times per second we close the gap".
 * Using exp() means the result is the same at 30 fps and 144 fps.
 */
export function damp(current: number, target: number, speed: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-speed * dt))
}
