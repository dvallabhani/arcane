import { expect, test } from '@playwright/test'
import { failCameraWith, serveModelLocallyIfConfigured } from './helpers.ts'

// A fake camera device: Chrome supplies a synthetic video (no hand in it) and
// auto-accepts the permission prompt. Error tests override getUserMedia instead.
test.use({
  launchOptions: {
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
})

test.describe('camera errors are explained and recoverable', () => {
  test('permission denied', async ({ page }) => {
    await failCameraWith(page, 'NotAllowedError')
    await page.goto('/')
    await page.getByTestId('play-webcam').click()
    const error = page.getByTestId('camera-error')
    await expect(error).toHaveAttribute('data-kind', 'denied')
    await expect(error).toContainText('Camera access is blocked')

    // Falling back to the mouse keeps the game playable.
    await page.getByTestId('fallback-mouse').click()
    await expect(error).toHaveCount(0)
    await expect(page.getByTestId('hint')).toContainText('Press and hold')
  })

  test('no camera connected', async ({ page }) => {
    await failCameraWith(page, 'NotFoundError')
    await page.goto('/')
    await page.getByTestId('play-webcam').click()
    await expect(page.getByTestId('camera-error')).toHaveAttribute('data-kind', 'no-camera')
    await expect(page.getByTestId('camera-error')).toContainText('No camera found')
  })

  test('camera busy in another app', async ({ page }) => {
    await failCameraWith(page, 'NotReadableError')
    await page.goto('/')
    await page.getByTestId('play-webcam').click()
    await expect(page.getByTestId('camera-error')).toHaveAttribute('data-kind', 'in-use')
  })
})

test.describe('with a (fake) camera', () => {
  test('hand-tracking model fails to download', async ({ page }) => {
    await page.route('https://storage.googleapis.com/**', (route) => route.abort())
    await page.goto('/')
    await page.getByTestId('play-webcam').click()
    await expect(page.getByTestId('camera-error')).toHaveAttribute('data-kind', 'model', { timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('permission granted: tracking starts and reports that no hand is visible', async ({ page }) => {
    await serveModelLocallyIfConfigured(page)
    await page.goto('/')
    await page.getByTestId('play-webcam').click()
    await page.keyboard.press('d')
    await expect(page.getByTestId('debug-camera')).toHaveText(/On \((GPU|CPU)\)/, { timeout: 45_000 })
    await expect(page.getByTestId('tracking-status')).toHaveText('No hand in view')
    await expect(page.getByTestId('debug-hand')).toHaveText('Not detected')
    await expect(page.getByTestId('hint')).toContainText('Raise one hand')

    // Switching to the mouse turns the camera off.
    await page.getByTestId('switch-mode').click()
    await expect(page.getByTestId('debug-camera')).toHaveText('Off')
  })
})
