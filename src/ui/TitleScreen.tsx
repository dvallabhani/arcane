import { REPO_URL } from '../config'
import { startGame } from '../game/session'
import { gameStore } from '../game/store'

export function TitleScreen() {
  return (
    <main className="title" aria-labelledby="title-heading">
      <div className="title__block">
        <h1 id="title-heading" className="wordmark">
          Arcane
        </h1>
        <p className="tagline">Your hands are the magic.</p>
        <p className="lede">
          Wake the pedestal with a pinch of your fingers, then hold back the shadows it draws in. Pluck crystals out of
          the air, smash them into the dark or hurl them across the chamber. Five waves, and something watching at the
          end.
        </p>

        <div className="title__actions">
          <button type="button" className="btn btn--primary" onClick={() => startGame('webcam')} data-testid="play-webcam">
            Play with webcam
          </button>
          <button type="button" className="btn" onClick={() => startGame('mouse')} data-testid="play-mouse">
            Play with mouse
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => gameStore.set({ showHowTo: true })}>
            How to play
          </button>
        </div>

        <p className="privacy">
          Hand tracking runs entirely in your browser. Your camera video is never uploaded or stored, and the camera
          only turns on if you choose to play with it.
        </p>
      </div>

      <footer className="title__footer">
        <span>A gesture-controlled game built with React, Three.js and MediaPipe.</span>{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </main>
  )
}
