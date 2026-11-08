import { useEffect, type RefObject } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { PointerInput } from '../game/input'
import { gameStore } from '../game/store'
import { cameraError, describeCameraError } from './cameraErrors'
import { GestureInterpreter } from './gestureInterpreter'
import { gpuIsTooSlow, HandTracker, loadHandLandmarker, requestCamera, stopStream, type LoadedLandmarker } from './handTracker'

interface Options {
  active: boolean
  /** Changing this number restarts the camera (used by "Try again"). */
  attempt: number
  videoRef: RefObject<HTMLVideoElement | null>
  input: PointerInput
  /** Called with the raw landmarks of every analysed frame (for the preview overlay). */
  onLandmarks?: (landmarks: NormalizedLandmark[] | null) => void
}

/**
 * Starts the webcam + hand tracking while `active` is true and cleans
 * everything up (camera light off, loop stopped) when it becomes false.
 *
 * Pipeline per camera frame:
 *   video frame -> MediaPipe HandLandmarker -> GestureInterpreter -> PointerInput
 * The 3D scene reads PointerInput every animation frame.
 */
export function useWebcamSession({ active, attempt, videoRef, input, onLandmarks }: Options): void {
  useEffect(() => {
    const video = videoRef.current
    if (!active || !video) return

    let cancelled = false
    let stream: MediaStream | null = null
    let tracker: HandTracker | null = null
    let fpsTimer = 0
    const interpreter = new GestureInterpreter()
    const set = gameStore.set

    async function start(target: HTMLVideoElement): Promise<void> {
      set({ camera: 'requesting', cameraError: null, handDetected: false, pinching: false, pinchRatio: null })

      // 1. Ask for the camera. The browser shows its permission prompt here.
      try {
        stream = await requestCamera()
      } catch (error) {
        console.warn('[arcane] camera unavailable', error)
        if (!cancelled) set({ camera: 'error', cameraError: describeCameraError(error) })
        return
      }
      if (cancelled) {
        stopStream(stream)
        return
      }
      target.srcObject = stream
      try {
        await target.play()
      } catch {
        // play() can reject if the element is removed mid-start; the next attempt will retry.
      }

      // 2. Load the hand-tracking model (cached after the first time).
      set({ camera: 'loading-model' })
      let loaded
      try {
        loaded = await loadHandLandmarker()
      } catch (error) {
        console.error('[arcane] failed to load hand landmarker', error)
        stopStream(stream) // turn the camera light off while we show the error
        stream = null
        if (!cancelled) set({ camera: 'error', cameraError: cameraError('model') })
        return
      }
      if (cancelled) return

      // 3. Analyse frames and translate them into game input.
      run(target, loaded)

      // 4. Once a second: update the fps readout, and if "GPU" detection turns
      //    out to be software-emulated and slow, switch to the CPU delegate.
      let switching = false
      fpsTimer = window.setInterval(() => {
        if (!tracker) return
        set({ trackingFps: tracker.fps })
        if (switching || gameStore.get().delegate !== 'GPU' || !gpuIsTooSlow(tracker)) return
        switching = true
        console.warn(`[arcane] GPU detection averages ${Math.round(tracker.averageDetectMs)} ms; switching to CPU`)
        tracker.stop()
        loadHandLandmarker('CPU')
          .then((cpu) => {
            if (!cancelled) run(target, cpu)
          })
          .catch((error: unknown) => {
            console.error('[arcane] CPU fallback failed, staying on GPU', error)
            tracker?.start()
          })
      }, 1000)
    }

    function run(target: HTMLVideoElement, loaded: LoadedLandmarker): void {
      tracker = new HandTracker(target, loaded.landmarker, (result, timeMs) => {
        const landmarks = result.landmarks[0] ?? null
        const world = result.worldLandmarks[0] ?? null
        const frame = interpreter.process(landmarks, world, timeMs)
        input.ndc = frame.ndc
        input.grip = frame.grip
        set({
          handDetected: frame.handVisible,
          pinching: frame.pinching,
          pinchRatio: frame.ratio === null ? null : Math.round(frame.ratio * 100) / 100,
        })
        onLandmarks?.(landmarks)
      })
      tracker.start()
      set({ camera: 'ready', delegate: loaded.delegate })
    }

    void start(video)

    return () => {
      cancelled = true
      tracker?.stop()
      window.clearInterval(fpsTimer)
      stopStream(stream)
      video.srcObject = null
      input.ndc = null
      input.grip = false
      onLandmarks?.(null)
      set({ camera: 'off', handDetected: false, pinching: false, pinchRatio: null, delegate: null, trackingFps: 0 })
    }
    // onLandmarks must be stable (wrap it in useCallback) or the camera would restart.
  }, [active, attempt, videoRef, input, onLandmarks])
}
