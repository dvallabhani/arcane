import { expect, test } from '@playwright/test'
import { awaken, drag, screenPoint, startWave, waitForSceneToSettle, world } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await page.goto('/?debug')
  await expect(page.getByRole('heading', { name: 'Arcane' })).toBeVisible()
})

test('title screen offers both control modes and never touches the camera', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { cameraCalls: number }).cameraCalls = 0
    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
    if (original) {
      navigator.mediaDevices.getUserMedia = (c) => {
        ;(window as unknown as { cameraCalls: number }).cameraCalls++
        return original(c)
      }
    }
  })
  await page.reload()
  await expect(page.getByText('Your hands are the magic.')).toBeVisible()
  await expect(page.getByTestId('play-webcam')).toBeVisible()
  await page.getByTestId('play-mouse').click()
  await waitForSceneToSettle(page)
  expect(await page.evaluate(() => (window as unknown as { cameraCalls: number }).cameraCalls)).toBe(0)
})

test('awakening: carrying the crystal to the pedestal starts the first wave', async ({ page }) => {
  await page.getByTestId('play-mouse').click()
  await waitForSceneToSettle(page)
  await expect(page.getByText('Use your magic to place the crystal on the pedestal.')).toBeVisible()
  await drag(page, await screenPoint(page, 'start'), await screenPoint(page, 'socket'))
  await expect(page.getByTestId('banner')).toContainText('Magic Awakened!')
  await expect(page.getByTestId('banner')).toContainText('First Shadows', { timeout: 30_000 })
  await expect(page.getByTestId('pedestal-health')).toContainText('100')
})

test('awakening also works with an instant drag (press, move and release within one frame)', async ({ page }) => {
  await page.getByTestId('play-mouse').click()
  await waitForSceneToSettle(page)
  const start = await screenPoint(page, 'start')
  const socket = await screenPoint(page, 'socket')
  await page.evaluate(
    ([a, b]) => {
      const stage = document.querySelector('[data-testid="stage"]')!
      const fire = (type: string, p: { x: number; y: number }) =>
        stage.dispatchEvent(new PointerEvent(type, { clientX: p.x, clientY: p.y, button: 0, pointerId: 1, bubbles: true }))
      fire('pointerdown', a)
      fire('pointermove', b)
      fire('pointerup', b)
    },
    [start, socket],
  )
  await expect.poll(async () => (await world(page)).phase).toBe('awakened')
})

test('dropping the crystal away from the pedestal leaves it there', async ({ page }) => {
  await page.getByTestId('play-mouse').click()
  await waitForSceneToSettle(page)
  await drag(page, await screenPoint(page, 'start'), await screenPoint(page, { x: -1.2, y: 3.2 }))
  const heart = (await world(page)).shards.find((s) => s.kind === 'heart')!
  expect(heart.state).toBe('resting')
  expect(heart.x).toBeGreaterThan(-1.8)
  expect((await world(page)).phase).toBe('intro')
})

test('smash: a shard carried into a shadow destroys it and scores', async ({ page }) => {
  await awaken(page)
  await startWave(page, 1)
  const well = (await world(page)).shards.find((s) => s.kind === 'shard' && s.x < -3)!
  // A shadow right next to that well.
  await page.evaluate(([x, y]) => window.__arcane.debug!.spawn('wisp', x, y), [well.x + 1.1, well.y + 0.4])
  const target = (await world(page)).enemies.at(-1)!
  await drag(page, await screenPoint(page, well), await screenPoint(page, target), { steps: 10, release: false })
  // Keep chasing the shadow with the held shard until it is destroyed.
  for (let i = 0; i < 60 && (await world(page)).score === 0; i++) {
    const enemy = (await world(page)).enemies.find((e) => e.id === target.id)
    if (!enemy) break
    const p = await screenPoint(page, enemy)
    await page.mouse.move(p.x, p.y, { steps: 2 })
  }
  await expect.poll(async () => (await world(page)).score, { timeout: 20_000 }).toBeGreaterThan(0)
  await page.mouse.up()
  await expect(page.getByTestId('score')).not.toContainText(/^0$/)
})

test('throw: a quick flick of the mouse throws the shard', async ({ page }) => {
  await awaken(page)
  await startWave(page, 1)
  const well = (await world(page)).shards.find((s) => s.kind === 'shard' && s.x < -3)!
  await page.evaluate(([x, y]) => window.__arcane.debug!.spawn('wisp', x, y), [well.x + 2.2, well.y + 1.6])

  // Watch every frame (in the page) for a shard in flight or a kill, since a throw lasts a fraction of a second.
  const thrown = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const t0 = performance.now()
        const check = () => {
          const w = window.__arcane.world()
          if (w.shards.some((s) => s.state === 'flying') || w.score > 0) return resolve(true)
          if (performance.now() - t0 > 20_000) return resolve(false)
          requestAnimationFrame(check)
        }
        check()
      }),
  )
  const from = await screenPoint(page, well)
  const to = await screenPoint(page, { x: well.x + 1.6, y: well.y + 1.2 })
  await page.mouse.move(from.x, from.y)
  await page.waitForTimeout(100)
  await page.mouse.down()
  await expect.poll(async () => (await world(page)).held).toBe('shard')
  // Flick: a few fast moves, then let go mid-motion.
  for (let i = 1; i <= 4; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 4, from.y + ((to.y - from.y) * i) / 4)
  await page.mouse.up()
  expect(await thrown).toBe(true)
})

test('pause with Escape freezes the game; Resume continues it', async ({ page }) => {
  await awaken(page)
  await startWave(page, 1)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause-menu')).toBeVisible()
  expect((await world(page)).paused).toBe(true)
  await page.getByTestId('resume').click()
  await expect(page.getByTestId('pause-menu')).toHaveCount(0)
  expect((await world(page)).paused).toBe(false)
})

test('defeat: the run ends when the pedestal falls, and Try again starts over', async ({ page }) => {
  await awaken(page)
  await startWave(page, 1)
  await page.evaluate(() => {
    window.__arcane.debug!.setHp(1)
    window.__arcane.debug!.spawn('wisp', -1.4, 1.7)
  })
  await expect(page.getByTestId('end-screen')).toContainText('The light went out', { timeout: 30_000 })
  await page.getByTestId('play-again').click()
  await expect(page.getByTestId('end-screen')).toHaveCount(0)
  expect((await world(page)).phase).toBe('intro')
})

test('victory: defeating the Hollow Eye wins the run', async ({ page }) => {
  await awaken(page)
  await startWave(page, 5)
  await expect(page.getByTestId('boss-health')).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => (await world(page)).boss?.state, { timeout: 30_000 }).toBe('active')
  await page.evaluate(() => window.__arcane.debug!.damageBoss(999))
  await expect(page.getByTestId('end-screen')).toContainText('The chamber is saved', { timeout: 30_000 })
  expect(Number((await page.getByTestId('final-score').innerText()).replace(/,/g, ''))).toBeGreaterThan(5000)
})

test('status panel toggles with D and shows what is held', async ({ page }) => {
  await page.getByTestId('play-mouse').click()
  await waitForSceneToSettle(page)
  await page.keyboard.press('d')
  await expect(page.getByTestId('debug-camera')).toHaveText('Off')
  await expect(page.getByTestId('debug-held')).toHaveText('Nothing')
  const start = await screenPoint(page, 'start')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await expect(page.getByTestId('debug-held')).toHaveText('Heart crystal')
  await page.mouse.up()
  await page.keyboard.press('d')
  await expect(page.getByTestId('debug-held')).toHaveCount(0)
})

test('how to play opens as a dialog and closes with Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'How to play' }).click()
  const dialog = page.getByRole('dialog', { name: 'How to play' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Pinch your thumb and index finger')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
