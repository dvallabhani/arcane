import type { CameraStatus, ControlMode } from '../game/store'
import type { Phase, ShardKind } from '../game/world'

export interface HintContext {
  mode: ControlMode
  phase: Phase
  wave: number
  bossWave: boolean
  held: ShardKind | null
  hovering: boolean
  nearSocket: boolean
  handDetected: boolean
  camera: CameraStatus
}

/** The one-line instruction under the objective. It always describes the next useful action. */
export function hintFor(c: HintContext): string {
  const webcam = c.mode === 'webcam'
  if (webcam && c.camera !== 'ready') return ''
  if (webcam && !c.handDetected && c.phase !== 'victory' && c.phase !== 'defeat') return 'Raise one hand in front of the camera.'

  const grab = webcam ? 'Pinch' : 'Press and hold on'
  const letGo = webcam ? 'Open your fingers' : 'Let go'

  switch (c.phase) {
    case 'intro':
      if (c.held === 'heart') return c.nearSocket ? `${letGo} to set it on the pedestal.` : 'Carry it to the pedestal.'
      return c.hovering ? `${grab} the crystal to lift it.` : webcam ? 'Point your index finger at the crystal.' : 'Press and hold on the crystal to lift it.'
    case 'awakened':
      return 'The light has drawn the shadows. Get ready.'
    case 'victory':
    case 'defeat':
      return ''
  }

  if (c.held === 'ward' || c.held === 'nova') {
    return c.nearSocket ? `${letGo} to release its power.` : 'Bring it to the pedestal.'
  }
  if (c.held === 'shard') {
    return webcam ? 'Smash shadows with it, or flick your hand and open your fingers to throw.' : 'Smash shadows with it, or fling it and let go to throw.'
  }
  if (c.hovering) return `${grab} the crystal to take it.`
  if (c.bossWave) return 'Shoot down the dark orbs and strike the Eye.'
  if (c.wave <= 2) return webcam ? 'Pinch a crystal shard from a well to arm yourself.' : 'Grab a crystal shard from a well to arm yourself.'
  return 'Protect the pedestal.'
}
