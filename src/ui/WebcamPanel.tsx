import { useCallback, useRef } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { pointerInput, retryCamera, switchMode } from '../game/session'
import { useGame } from '../game/store'
import { useWebcamSession } from '../vision/useWebcamSession'

/** Pairs of landmark indices that form the hand "skeleton" (MediaPipe's 21-point topology). */
const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20], // pinky + palm
]

/**
 * Owns the <video> element, runs the webcam session, and shows a small
 * mirrored preview with the tracked hand drawn on top, plus status and error
 * messages.
 */
export function WebcamPanel() {
  const camera = useGame((s) => s.camera)
  const error = useGame((s) => s.cameraError)
  const attempt = useGame((s) => s.cameraAttempt)
  const hand = useGame((s) => s.handDetected)
  const pinching = useGame((s) => s.pinching)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const drawLandmarks = useCallback((landmarks: NormalizedLandmark[] | null) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { width: w, height: h } = canvas
    ctx.clearRect(0, 0, w, h)
    if (!landmarks) return
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(196, 166, 255, 0.85)'
    ctx.beginPath()
    for (const [a, b] of BONES) {
      ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h)
      ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h)
    }
    ctx.stroke()
    // Highlight the two points that matter: thumb tip (4) and index tip (8).
    for (const i of [4, 8]) {
      ctx.fillStyle = i === 8 ? '#5ef2ff' : '#ffc65c'
      ctx.beginPath()
      ctx.arc(landmarks[i].x * w, landmarks[i].y * h, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [])

  useWebcamSession({ active: true, attempt, videoRef, input: pointerInput, onLandmarks: drawLandmarks })

  const status =
    camera !== 'ready' ? null : !hand ? 'No hand in view' : pinching ? 'Pinching' : 'Hand tracked'

  return (
    <>
      <figure className={`preview ${camera === 'ready' ? 'preview--live' : ''}`} aria-label="Camera preview">
        {/* The video is mirrored with CSS so it behaves like a mirror. */}
        <div className="preview__frame">
          <video ref={videoRef} className="preview__video" muted playsInline width={640} height={480} />
          <canvas ref={canvasRef} className="preview__overlay" width={320} height={240} />
        </div>
        {status && (
          <figcaption className={`preview__status ${hand ? 'is-on' : ''}`} data-testid="tracking-status">
            {status}
          </figcaption>
        )}
      </figure>

      {(camera === 'requesting' || camera === 'loading-model') && (
        <div className="notice" role="status" data-testid="camera-notice">
          <p className="notice__title">{camera === 'requesting' ? 'Waiting for your camera' : 'Preparing hand tracking'}</p>
          <p className="notice__text">
            {camera === 'requesting'
              ? 'Your browser will ask for permission to use the camera.'
              : 'Downloading the hand-tracking model. This takes a few seconds the first time.'}
          </p>
        </div>
      )}

      {camera === 'error' && error && (
        <div className="notice notice--error" role="alert" data-testid="camera-error" data-kind={error.kind}>
          <p className="notice__title">{error.title}</p>
          <p className="notice__text">{error.message}</p>
          <div className="notice__actions">
            <button type="button" className="btn btn--primary" onClick={retryCamera}>
              Try again
            </button>
            <button type="button" className="btn" onClick={() => switchMode('mouse')} data-testid="fallback-mouse">
              Play with mouse
            </button>
          </div>
        </div>
      )}
    </>
  )
}
