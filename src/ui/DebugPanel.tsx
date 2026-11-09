import { WAVES } from '../game/content'
import { world } from '../game/session'
import { gameStore, useGame, type CameraStatus } from '../game/store'
import type { Phase, ShardKind } from '../game/world'

const HELD_LABEL: Record<ShardKind, string> = { heart: 'Heart crystal', shard: 'Crystal shard', ward: 'Ward crystal', nova: 'Nova crystal' }
const PHASE_LABEL: Record<Phase, string> = {
  intro: 'Awakening',
  awakened: 'Awakened',
  'wave-intro': 'Starting',
  wave: 'Fighting',
  'wave-clear': 'Cleared',
  victory: 'Won',
  defeat: 'Lost',
}

/** With ?debug in the URL, the panel can jump straight to any wave (handy for reviewers short on time). */
const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

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
  const held = useGame((s) => s.held)
  const phase = useGame((s) => s.phase)
  const wave = useGame((s) => s.wave)
  const enemies = useGame((s) => s.enemies)

  const rows: [string, string, string][] = [
    ['Mode', mode === 'webcam' ? 'Webcam' : 'Mouse', 'mode'],
    ['Camera', camera === 'ready' && delegate ? `On (${delegate})` : CAMERA_LABEL[camera], 'camera'],
    ['Hand', hand ? 'Detected' : 'Not detected', 'hand'],
    ['Pinch', `${pinching ? 'Pinching' : 'Open'}${ratio !== null ? `, ratio ${ratio.toFixed(2)}` : ''}`, 'pinch'],
    ['Holding', held ? HELD_LABEL[held] : 'Nothing', 'held'],
    ['Game', phase === 'intro' ? 'Awakening' : `${PHASE_LABEL[phase]}, wave ${wave}`, 'phase'],
    ['Shadows', String(enemies), 'enemies'],
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
        <div id="debug-panel" className="debug__list">
          <dl className="debug__rows">
            {rows.map(([label, value, key]) => (
              <div key={key} className="debug__row">
                <dt>{label}</dt>
                <dd data-testid={`debug-${key}`}>{value}</dd>
              </div>
            ))}
          </dl>
          {DEBUG && (
            <div className="debug__jump">
              <span>Jump to wave</span>
              {WAVES.map((w, i) => (
                <button key={w.name} type="button" onClick={() => world.debugSkipToWave(i + 1)} title={w.name}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
