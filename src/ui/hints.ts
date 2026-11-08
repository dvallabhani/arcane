import type { CrystalState } from '../game/interaction'
import type { CameraStatus, ControlMode } from '../game/store'

export interface HintContext {
  mode: ControlMode
  crystal: CrystalState
  nearSocket: boolean
  handDetected: boolean
  camera: CameraStatus
}

/** The one-line instruction under the objective. It always describes the next action. */
export function hintFor(c: HintContext): string {
  if (c.crystal === 'placed') return 'The chamber is awake.'

  if (c.mode === 'mouse') {
    if (c.crystal === 'grabbed') return c.nearSocket ? 'Let go to set it on the pedestal.' : 'Drag it over the pedestal.'
    return c.crystal === 'hovered' ? 'Press and hold to lift the crystal.' : 'Press and hold on the crystal to lift it.'
  }

  if (c.camera !== 'ready') return ''
  if (!c.handDetected) return 'Raise one hand in front of the camera.'
  if (c.crystal === 'grabbed') return c.nearSocket ? 'Open your fingers to let go.' : 'Keep pinching and move to the pedestal.'
  if (c.crystal === 'hovered') return 'Pinch your thumb and index finger to grab it.'
  return 'Point your index finger at the crystal.'
}
