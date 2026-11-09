import { expect, type Page } from '@playwright/test'

type Point = { x: number; y: number }

interface WorldSnapshot {
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

declare global {
  interface Window {
    __arcane: {
      state(): { mode: string; camera: string; best: number }
      world(): WorldSnapshot
      worldToScreen(x: number, y: number): Point | null
      points: { start: Point; socket: Point; wells: Point[] }
      debug?: {
        skipToWave(n: number): void
        setHp(hp: number): void
        damageBoss(amount: number): void
        spawn(kind: string, x: number, y: number): void
      }
    }
  }
}

/** Screen position (CSS pixels) of a point on the play plane. */
export async function screenPoint(page: Page, which: 'start' | 'socket' | Point): Promise<Point> {
  return page.evaluate((w) => {
    const a = window.__arcane
    const p = typeof w === 'string' ? a.points[w] : w
    return a.worldToScreen(p.x, p.y)!
  }, which)
}

export const world = (page: Page) => page.evaluate(() => window.__arcane.world())

/** Waits until the camera glide from the title screen has settled. */
export async function waitForSceneToSettle(page: Page): Promise<void> {
  let prev = await screenPoint(page, 'socket')
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150)
    const now = await screenPoint(page, 'socket')
    if (Math.hypot(now.x - prev.x, now.y - prev.y) < 0.5) return
    prev = now
  }
}

/** Presses on `from`, moves in small steps to `to`, then (optionally) releases, like a person dragging. */
export async function drag(page: Page, from: Point, to: Point, { steps = 20, release = true } = {}): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.waitForTimeout(100)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps)
    await page.waitForTimeout(16)
  }
  if (!release) return
  await page.waitForTimeout(400) // hold still so the release isn't a throw
  await page.mouse.up()
}

/** Starts mouse mode and carries the heart crystal to the pedestal. */
export async function awaken(page: Page): Promise<void> {
  await page.getByTestId('play-mouse').click()
  await waitForSceneToSettle(page)
  await drag(page, await screenPoint(page, 'start'), await screenPoint(page, 'socket'))
  await expect.poll(async () => (await world(page)).phase).not.toBe('intro')
}

/** With ?debug: jumps to wave n and waits until shadows can arrive. */
export async function startWave(page: Page, n: number): Promise<void> {
  await page.evaluate((wave) => window.__arcane.debug!.skipToWave(wave), n)
  await expect.poll(async () => (await world(page)).phase, { timeout: 30_000 }).toBe('wave')
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
