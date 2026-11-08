import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision'
// Vite turns these into URLs of files bundled with the site, so the WebAssembly
// runtime always matches the installed npm version and needs no third-party CDN.
import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'

/** Google's official hand landmark model (float16, ~7.8 MB). Downloaded once, then cached by the browser. */
export const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export interface LoadedLandmarker {
  landmarker: HandLandmarker
  delegate: Delegate
}

export type Delegate = 'GPU' | 'CPU'

const cache = new Map<Delegate, Promise<LoadedLandmarker>>()

/**
 * Loads MediaPipe once per delegate and reuses it. The library itself is
 * imported lazily, so players who only use the mouse never download it.
 *
 * GPU (WebGL2) is preferred; if it can't be created we fall back to CPU.
 */
export function loadHandLandmarker(preferred: Delegate = 'GPU'): Promise<LoadedLandmarker> {
  let promise = cache.get(preferred)
  if (!promise) {
    promise = createLandmarker(preferred).catch((error: unknown) => {
      cache.delete(preferred) // allow a retry after a network failure
      throw error
    })
    cache.set(preferred, promise)
  }
  return promise
}

async function createLandmarker(preferred: Delegate): Promise<LoadedLandmarker> {
  const { HandLandmarker } = await import('@mediapipe/tasks-vision')
  const fileset = { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl }
  const options = (delegate: Delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO' as const,
    numHands: 1, // one hand is all we need, and it halves the work
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  })
  if (preferred === 'CPU') {
    return { landmarker: await HandLandmarker.createFromOptions(fileset, options('CPU')), delegate: 'CPU' }
  }
  try {
    return { landmarker: await HandLandmarker.createFromOptions(fileset, options('GPU')), delegate: 'GPU' }
  } catch (gpuError) {
    // Some machines have no usable WebGL2; the CPU path works everywhere.
    console.warn('[arcane] GPU delegate unavailable, falling back to CPU', gpuError)
    return loadHandLandmarker('CPU')
  }
}

/** Asks for the webcam. Throws a DOMException (NotAllowedError, NotFoundError, ...) on failure. */
export async function requestCamera(): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('Camera requires a secure context', 'InsecureContextError')
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  })
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export type ResultHandler = (result: HandLandmarkerResult, timeMs: number) => void

const WARMUP_DETECTIONS = 5

/**
 * If GPU detection averages slower than this, the "GPU" is probably software
 * emulated (hardware acceleration off, a VM...). The CPU path is then much
 * faster, so we switch. Real GPUs take roughly 5–15 ms per frame.
 */
export const SLOW_GPU_MS = 60

/** True once enough frames have been timed to judge the GPU path as too slow. */
export function gpuIsTooSlow(tracker: HandTracker): boolean {
  return tracker.detections >= WARMUP_DETECTIONS + 10 && tracker.averageDetectMs > SLOW_GPU_MS
}

/**
 * Runs hand detection on a playing <video>. Detection is skipped when the
 * camera hasn't produced a new frame and is capped at `maxFps`, so we never
 * analyse the same image twice or burn CPU faster than the camera delivers.
 */
export class HandTracker {
  /** Detections per second, measured over the last second. */
  fps = 0
  /** Smoothed time one detection takes, in milliseconds. */
  averageDetectMs = 0
  /** Number of detections run so far. */
  detections = 0

  private readonly video: HTMLVideoElement
  private readonly landmarker: HandLandmarker
  private readonly onResult: ResultHandler
  private readonly minIntervalMs: number
  private rafId = 0
  private running = false
  private lastVideoTime = -1
  private lastDetectAt = 0
  private framesThisSecond = 0
  private secondStartedAt = 0

  constructor(video: HTMLVideoElement, landmarker: HandLandmarker, onResult: ResultHandler, maxFps = 30) {
    this.video = video
    this.landmarker = landmarker
    this.onResult = onResult
    this.minIntervalMs = 1000 / maxFps
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.secondStartedAt = performance.now()
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  private tick = (): void => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.tick)

    const now = performance.now()
    const video = this.video
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
    if (video.currentTime === this.lastVideoTime) return // no new camera frame yet
    if (now - this.lastDetectAt < this.minIntervalMs - 1) return // throttle

    this.lastVideoTime = video.currentTime
    this.lastDetectAt = now

    let result: HandLandmarkerResult
    try {
      result = this.landmarker.detectForVideo(video, now)
    } catch (error) {
      console.error('[arcane] hand detection failed for a frame', error)
      return
    }
    // Track how long detection takes. The first few runs include one-time
    // warm-up (shader compilation), so they're left out of the average.
    const took = performance.now() - now
    this.detections++
    if (this.detections === WARMUP_DETECTIONS + 1) this.averageDetectMs = took
    else if (this.detections > WARMUP_DETECTIONS) this.averageDetectMs = this.averageDetectMs * 0.8 + took * 0.2

    this.framesThisSecond++
    if (now - this.secondStartedAt >= 1000) {
      this.fps = Math.round((this.framesThisSecond * 1000) / (now - this.secondStartedAt))
      this.framesThisSecond = 0
      this.secondStartedAt = now
    }
    this.onResult(result, now)
  }
}
