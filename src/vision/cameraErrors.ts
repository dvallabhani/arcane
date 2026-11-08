export type CameraErrorKind = 'denied' | 'no-camera' | 'in-use' | 'insecure' | 'model' | 'unknown'

export interface CameraErrorInfo {
  kind: CameraErrorKind
  title: string
  message: string
}

const MESSAGES: Record<CameraErrorKind, Omit<CameraErrorInfo, 'kind'>> = {
  denied: {
    title: 'Camera access is blocked',
    message:
      'Allow camera access for this site (usually the camera icon in the address bar), then try again. You can also play with the mouse.',
  },
  'no-camera': {
    title: 'No camera found',
    message: 'Connect a webcam and try again, or play with the mouse instead.',
  },
  'in-use': {
    title: 'The camera is busy',
    message: 'Another app or browser tab is using the camera. Close it and try again.',
  },
  insecure: {
    title: 'Camera needs a secure page',
    message: 'Browsers only allow camera access on https:// pages or localhost.',
  },
  model: {
    title: 'Hand tracking could not load',
    message: 'The hand-tracking model failed to download. Check your connection and try again.',
  },
  unknown: {
    title: 'The camera could not start',
    message: 'Something went wrong while starting the camera. Try again, or play with the mouse.',
  },
}

export function cameraError(kind: CameraErrorKind): CameraErrorInfo {
  return { kind, ...MESSAGES[kind] }
}

/** Maps a getUserMedia() exception to a message a person can act on. */
export function describeCameraError(error: unknown): CameraErrorInfo {
  const name = error instanceof Error || error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return cameraError('denied')
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return cameraError('no-camera')
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return cameraError('in-use')
    case 'InsecureContextError':
      return cameraError('insecure')
    default:
      return cameraError('unknown')
  }
}
