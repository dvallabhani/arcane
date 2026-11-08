import { resetGame, returnToMenu, switchMode } from '../game/session'
import { useGame } from '../game/store'
import { DebugPanel } from './DebugPanel'
import { hintFor } from './hints'

export function Hud() {
  const mode = useGame((s) => s.mode)
  const crystal = useGame((s) => s.crystal)
  const nearSocket = useGame((s) => s.nearSocket)
  const handDetected = useGame((s) => s.handDetected)
  const camera = useGame((s) => s.camera)
  const completed = useGame((s) => s.completed)
  const hint = hintFor({ mode, crystal, nearSocket, handDetected, camera })

  return (
    <>
      <header className="hud">
        <div className="objective">
          <p className="objective__goal">Use your magic to place the crystal on the pedestal.</p>
          <p className="objective__hint" aria-live="polite" data-testid="hint">
            {hint}
          </p>
        </div>
        <nav className="hud__actions" aria-label="Game controls">
          <button type="button" className="btn btn--small" onClick={resetGame} data-testid="reset">
            Reset
          </button>
          <button
            type="button"
            className="btn btn--small"
            onClick={() => switchMode(mode === 'webcam' ? 'mouse' : 'webcam')}
            data-testid="switch-mode"
          >
            {mode === 'webcam' ? 'Use mouse' : 'Use webcam'}
          </button>
          <button type="button" className="btn btn--small btn--quiet" onClick={returnToMenu}>
            Menu
          </button>
        </nav>
      </header>

      {completed && (
        <section className="victory" role="status" data-testid="victory">
          <h2 className="victory__title">Magic Awakened!</h2>
          <p className="victory__text">The pedestal has taken the crystal and the chamber is alive.</p>
          <div className="victory__actions">
            <button type="button" className="btn btn--primary" onClick={resetGame} data-testid="play-again">
              Play again
            </button>
            <button type="button" className="btn btn--quiet" onClick={returnToMenu}>
              Menu
            </button>
          </div>
        </section>
      )}

      <DebugPanel />
    </>
  )
}
