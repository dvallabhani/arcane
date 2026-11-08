import { gameStore, useGame, type CameraStatus } from '../game/store'

const CAMERA_LABEL: Record<CameraStatus, string> = {
  off: 'Off',
  requesting: 'Waiting for permission',
  'loading-model': 'Loading model',
  ready: 'On',
  error: 'Error',
}

/** Small, collapsible status readout. Toggle with the button or the D key. */
export function DebugPanel() {
  const open = useGame((s) => s.showDebug)
  const mode = useGame((s) => s.mode)
  const camera = useGame((s) => s.camera)
  const delegate = useGame((s) => s.delegate)
  const fps = useGame((s) => s.trackingFps)
  const hand = useGame((s) => s.handDetected)
  const pinching = useGame((s) => s.pinching)
  const ratio = useGame((s) => s.pinchRatio)
  const crystal = useGame((s) => s.crystal)

  const rows: [string, string, string][] = [
    ['Mode', mode === 'webcam' ? 'Webcam' : 'Mouse', 'mode'],
    ['Camera', camera === 'ready' && delegate ? `On (${delegate})` : CAMERA_LABEL[camera], 'camera'],
    ['Hand', hand ? 'Detected' : 'Not detected', 'hand'],
    ['Pinch', `${pinching ? 'Pinching' : 'Open'}${ratio !== null ? `, ratio ${ratio.toFixed(2)}` : ''}`, 'pinch'],
    ['Crystal', crystal === 'grabbed' ? 'Grabbed' : crystal === 'placed' ? 'Placed' : `Released (${crystal})`, 'crystal'],
  ]
  if (mode === 'webcam') rows.push(['Tracking', camera === 'ready' ? `${fps} fps` : '—', 'fps'])

  return (
    <aside className="debug" data-testid="debug">
      <button
        type="button"
        className="debug__toggle"
        aria-expanded={open}
        aria-controls="debug-panel"
        onClick={() => gameStore.set({ showDebug: !open })}
      >
        {open ? 'Hide status' : 'Status'}
      </button>
      {open && (
        <dl id="debug-panel" className="debug__list">
          {rows.map(([label, value, key]) => (
            <div key={key} className="debug__row">
              <dt>{label}</dt>
              <dd data-testid={`debug-${key}`}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  )
}
