import type { Page } from '@playwright/test'

type Point = { x: number; y: number }

declare global {
  interface Window {
    __arcane: {
      crystal(): { state: string; x: number; y: number }
      state(): { completed: boolean; camera: string; mode: string }
      worldToScreen(x: number, y: number): Point | null
      points: { start: Point; socket: Point }
    }
  }
}

/** Screen position (CSS pixels) of a point on the interaction plane. */
export async function screenPoint(page: Page, which: 'start' | 'socket' | Point): Promise<Point> {
  return page.evaluate((w) => {
    const a = window.__arcane
    const p = typeof w === 'string' ? a.points[w] : w
    return a.worldToScreen(p.x, p.y)!
  }, which)
}

export const crystal = (page: Page) => page.evaluate(() => window.__arcane.crystal())

/** Waits until the camera glide from the title screen has settled. */
export async function waitForSceneToSettle(page: Page): Promise<void> {
  let prev = await screenPoint(page, 'start')
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150)
    const now = await screenPoint(page, 'start')
    if (Math.hypot(now.x - prev.x, now.y - prev.y) < 0.5) return
    prev = now
  }
}

/** Presses on `from`, moves in small steps to `to` and releases, like a person dragging. */
export async function drag(page: Page, from: Point, to: Point, steps = 25): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.waitForTimeout(100)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(400) // let the crystal catch up with the cursor
  await page.mouse.up()
}

/**
 * This sandbox can't reach Google's model host, so tests may point
 * ARCANE_MODEL_FIXTURE at a local copy of hand_landmarker.task.
 * Without it, the real URL is used.
 */
export async function serveModelLocallyIfConfigured(page: Page): Promise<void> {
  const fixture = process.env.ARCANE_MODEL_FIXTURE
  if (!fixture) return
  await page.route('https://storage.googleapis.com/**', (route) => route.fulfill({ path: fixture }))
}

/** Replaces getUserMedia so it fails the way a browser does when access is blocked or no camera exists. */
export async function failCameraWith(page: Page, errorName: string): Promise<void> {
  await page.addInitScript((name) => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('simulated', name))
  }, errorName)
}
