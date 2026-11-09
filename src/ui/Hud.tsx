import { restartRun, returnToMenu, resume, switchMode, toggleMute, togglePause } from '../game/session'
import { useGame } from '../game/store'
import { DebugPanel } from './DebugPanel'
import { hintFor } from './hints'

export function Hud() {
  const mode = useGame((s) => s.mode)
  const phase = useGame((s) => s.phase)
  const wave = useGame((s) => s.wave)
  const waveCount = useGame((s) => s.waveCount)
  const waveName = useGame((s) => s.waveName)
  const bossWave = useGame((s) => s.bossWave)
  const held = useGame((s) => s.held)
  const hovering = useGame((s) => s.hovering)
  const nearSocket = useGame((s) => s.nearSocket)
  const handDetected = useGame((s) => s.handDetected)
  const camera = useGame((s) => s.camera)
  const muted = useGame((s) => s.muted)
  const paused = useGame((s) => s.paused)
  const hint = hintFor({ mode, phase, wave, bossWave, held, hovering, nearSocket, handDetected, camera })
  const intro = phase === 'intro'
  const over = phase === 'victory' || phase === 'defeat'

  return (
    <>
      <header className="hud">
        <div className="objective">
          <p className="objective__goal">
            {intro ? 'Use your magic to place the crystal on the pedestal.' : `Wave ${wave} of ${waveCount}: ${waveName}`}
          </p>
          <p className="objective__hint" aria-live="polite" data-testid="hint">
            {hint}
          </p>
        </div>
        {!intro && <Vitals />}
        <div className="hud__right">
          {!intro && <Score />}
          <nav className="hud__actions" aria-label="Game controls">
            <button type="button" className="btn btn--small" onClick={toggleMute} data-testid="mute">
              {muted ? 'Unmute' : 'Mute'}
            </button>
            {!over && (
              <button type="button" className="btn btn--small" onClick={togglePause} data-testid="pause">
                Pause
              </button>
            )}
          </nav>
        </div>
      </header>

      <Banner />
      {paused && <PauseMenu mode={mode} />}
      {over && <EndScreen />}
      <DebugPanel />
    </>
  )
}

/** Pedestal health (and the boss's health during the final wave). */
function Vitals() {
  const hp = useGame((s) => s.hp)
  const maxHp = useGame((s) => s.maxHp)
  const shielded = useGame((s) => s.shielded)
  const bossHp = useGame((s) => s.bossHp)
  const bossMaxHp = useGame((s) => s.bossMaxHp)
  const low = hp <= maxHp * 0.3
  return (
    <div className="vitals">
      <div className={`meter ${low ? 'meter--low' : ''} ${shielded ? 'meter--shielded' : ''}`} data-testid="pedestal-health">
        <span className="meter__label">{shielded ? 'Pedestal (shielded)' : 'Pedestal'}</span>
        <span className="meter__track" role="meter" aria-label="Pedestal health" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}>
          <span className="meter__fill" style={{ width: `${(hp / maxHp) * 100}%` }} />
        </span>
        <span className="meter__value">{hp}</span>
      </div>
      {bossMaxHp > 0 && bossHp > 0 && (
        <div className="meter meter--boss" data-testid="boss-health">
          <span className="meter__label">The Hollow Eye</span>
          <span className="meter__track" role="meter" aria-label="Boss health" aria-valuemin={0} aria-valuemax={bossMaxHp} aria-valuenow={bossHp}>
            <span className="meter__fill" style={{ width: `${(bossHp / bossMaxHp) * 100}%` }} />
          </span>
        </div>
      )}
    </div>
  )
}

function Score() {
  const score = useGame((s) => s.score)
  const multiplier = useGame((s) => s.multiplier)
  return (
    <div className="score" data-testid="score">
      <span className="score__value">{score.toLocaleString('en-US')}</span>
      {multiplier > 1 && <span className="score__combo">×{multiplier} combo</span>}
    </div>
  )
}

/** Big centred announcements between phases. */
function Banner() {
  const phase = useGame((s) => s.phase)
  const wave = useGame((s) => s.wave)
  const waveName = useGame((s) => s.waveName)
  const bossWave = useGame((s) => s.bossWave)
  const bonus = useGame((s) => s.waveBonus)

  if (phase === 'awakened') {
    return (
      <section className="banner banner--gold" role="status" data-testid="banner">
        <h2 className="banner__title">Magic Awakened!</h2>
        <p className="banner__text">The light has drawn the shadows. Defend the pedestal.</p>
      </section>
    )
  }
  if (phase === 'wave-intro') {
    return (
      <section key={`wave-${wave}`} className={`banner ${bossWave ? 'banner--boss' : ''}`} role="status" data-testid="banner">
        <p className="banner__kicker">{bossWave ? 'Final wave' : `Wave ${wave}`}</p>
        <h2 className="banner__title">{waveName}</h2>
      </section>
    )
  }
  if (phase === 'wave-clear') {
    return (
      <section className="banner" role="status" data-testid="banner">
        <h2 className="banner__title">Wave cleared</h2>
        <p className="banner__text">+{bonus.toLocaleString('en-US')} points</p>
      </section>
    )
  }
  return null
}

function PauseMenu({ mode }: { mode: 'mouse' | 'webcam' }) {
  const reason = useGame((s) => s.pauseReason)
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-heading" data-testid="pause-menu">
      <div className="overlay__panel">
        <h2 id="pause-heading" className="overlay__title">
          {reason === 'hand' ? 'Hand lost' : 'Paused'}
        </h2>
        <p className="overlay__text">
          {reason === 'hand'
            ? 'Raise your hand in front of the camera and the game continues by itself.'
            : 'The shadows are waiting.'}
        </p>
        <div className="overlay__actions">
          <button type="button" className="btn btn--primary" onClick={resume} autoFocus data-testid="resume">
            Resume
          </button>
          <button type="button" className="btn" onClick={restartRun}>
            Restart run
          </button>
          <button type="button" className="btn" onClick={() => switchMode(mode === 'webcam' ? 'mouse' : 'webcam')}>
            {mode === 'webcam' ? 'Use mouse' : 'Use webcam'}
          </button>
          <button type="button" className="btn btn--quiet" onClick={returnToMenu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  )
}

function EndScreen() {
  const phase = useGame((s) => s.phase)
  const score = useGame((s) => s.score)
  const best = useGame((s) => s.best)
  const newBest = useGame((s) => s.newBest)
  const wave = useGame((s) => s.wave)
  const won = phase === 'victory'
  return (
    <section className={`end ${won ? 'end--won' : 'end--lost'}`} role="status" data-testid="end-screen">
      <h2 className="end__title">{won ? 'The chamber is saved' : 'The light went out'}</h2>
      <p className="end__text">{won ? 'The Hollow Eye is gone and the pedestal still shines.' : `The shadows broke through on wave ${wave}.`}</p>
      <dl className="end__stats">
        <div>
          <dt>Score</dt>
          <dd data-testid="final-score">{score.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>{newBest ? 'New best' : 'Best'}</dt>
          <dd>{best.toLocaleString('en-US')}</dd>
        </div>
      </dl>
      <div className="end__actions">
        <button type="button" className="btn btn--primary" onClick={restartRun} autoFocus data-testid="play-again">
          {won ? 'Play again' : 'Try again'}
        </button>
        <button type="button" className="btn btn--quiet" onClick={returnToMenu}>
          Menu
        </button>
      </div>
    </section>
  )
}
