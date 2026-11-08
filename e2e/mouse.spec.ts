import { expect, test } from '@playwright/test'
import { crystal, drag, screenPoint, waitForSceneToSettle } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
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

test('mouse: drag the crystal onto the pedestal to complete the objective', async ({ page }) => {
  await page.getByTestId('play-mouse').click()
  await waitForSceneToSettle(page)
  await expect(page.getByText('Use your magic to place the crystal on the pedestal.')).toBeVisible()

  const start = await screenPoint(page, 'start')
  const socket = await screenPoint(page, 'socket')

  await page.mouse.move(start.x, start.y)
  await expect.poll(async () => (await crystal(page)).state).toBe('hovered')

  await page.mouse.down()
  await expect.poll(async () => (await crystal(page)).state).toBe('grabbed')
  await page.mouse.up()

  await drag(page, start, socket)
  await expect.poll(async () => (await crystal(page)).state).toBe('placed')
  await expect(page.getByTestId('victory')).toContainText('Magic Awakened!')

  // The crystal settles exactly on the socket.
  await page.waitForTimeout(1200)
  const c = await crystal(page)
  expect(c.x).toBeCloseTo(2.4, 1)
  expect(c.y).toBeCloseTo(1.98, 1)
})

test('mouse: releasing away from the pedestal leaves the crystal where it was dropped', async ({ page }) => {
  await page.getByTestId('play-mouse').click()
  await waitForSceneToSettle(page)
  const start = await screenPoint(page, 'start')
  const middle = await screenPoint(page, { x: 0, y: 2.6 })

  await drag(page, start, middle)
  const dropped = await crystal(page)
  expect(dropped.state).not.toBe('placed')
  expect(dropped.x).toBeGreaterThan(-0.6)
  expect(dropped.x).toBeLessThan(0.6)

  await page.mouse.move(10, 10)
  await page.waitForTimeout(500)
  const later = await crystal(page)
  expect(later.x).toBeCloseTo(dropped.x, 3)
  await expect(page.getByTestId('victory')).toHaveCount(0)
})

test('mouse: reset returns the crystal and clears the completion', async ({ page }) => {
  await page.getByTestId('play-mouse').click()
  await waitForSceneToSettle(page)
  await drag(page, await screenPoint(page, 'start'), await screenPoint(page, 'socket'))
  await expect(page.getByTestId('victory')).toBeVisible()

  await page.getByTestId('play-again').click()
  await expect(page.getByTestId('victory')).toHaveCount(0)
  const c = await crystal(page)
  expect(c).toMatchObject({ state: 'idle', x: -2.4, y: 1.9 })

  // ...and the experience can be completed again.
  await drag(page, await screenPoint(page, 'start'), await screenPoint(page, 'socket'))
  await expect(page.getByTestId('victory')).toBeVisible()
  await page.getByTestId('reset').click()
  await expect(page.getByTestId('victory')).toHaveCount(0)
})

test('status panel reports crystal state and toggles with D', async ({ page }) => {
  await page.getByTestId('play-mouse').click()
  await waitForSceneToSettle(page)
  await page.keyboard.press('d')
  await expect(page.getByTestId('debug-camera')).toHaveText('Off')
  await expect(page.getByTestId('debug-crystal')).toHaveText('Released (idle)')
  const start = await screenPoint(page, 'start')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await expect(page.getByTestId('debug-crystal')).toHaveText('Grabbed')
  await page.mouse.up()
  await page.keyboard.press('d')
  await expect(page.getByTestId('debug-crystal')).toHaveCount(0)
})

test('how to play opens as a dialog and closes with Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'How to play' }).click()
  const dialog = page.getByRole('dialog', { name: 'How to play' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Pinch your thumb and index finger')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
