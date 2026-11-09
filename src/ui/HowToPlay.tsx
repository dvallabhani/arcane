import { useEffect, useRef } from 'react'
import { gameStore } from '../game/store'

/** Uses the native <dialog> element, which gives focus trapping and Esc-to-close for free. */
export function HowToPlay() {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const close = () => gameStore.set({ showHowTo: false })

  return (
    <dialog
      ref={ref}
      className="howto"
      aria-labelledby="howto-heading"
      onClose={close}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close() // click on the backdrop
      }}
    >
      <h2 id="howto-heading">How to play</h2>
      <p className="howto__goal">Awaken the pedestal, then keep it alive through five waves of shadows.</p>

      <h3>The one move: pinch</h3>
      <p>
        With the webcam, your index fingertip is the cursor. Pinch your thumb and index finger together to pick up a
        crystal, keep pinching to carry it, and open your fingers to let go. With a mouse, press, drag and release.
      </p>

      <h3>What to do with crystals</h3>
      <ul>
        <li>
          <strong>Awaken:</strong> carry the large crystal to the pedestal to begin.
        </li>
        <li>
          <strong>Smash:</strong> take a shard from one of the four wells and ram it into shadows. A shard breaks after
          three hits; the well makes a new one.
        </li>
        <li>
          <strong>Throw:</strong> flick your hand and let go mid-motion. Thrown shards curve toward nearby targets.
        </li>
        <li>
          <strong>Ward</strong> (green): place it on the pedestal to heal it and raise a shield.
        </li>
        <li>
          <strong>Nova</strong> (orange): place it on the pedestal to blast every shadow nearby.
        </li>
      </ul>

      <h3>Shadows</h3>
      <p>
        Wisps drift in, darts tremble and then dash, brutes take three hits, splitters break in two. The last wave
        brings the Hollow Eye, which fires dark orbs at the pedestal. Shoot them down.
      </p>
      <p className="howto__tip">
        Quick kills build a combo multiplier. Webcam tips: about an arm’s length from the camera, hand lit from the
        front. If your hand leaves the camera, the game pauses until it comes back.
      </p>

      <h3>Keys</h3>
      <p className="howto__tip">Esc or P pause, M mute, D status panel.</p>

      <h3>Your privacy</h3>
      <p>Camera frames are analysed by Google’s MediaPipe hand tracker inside your browser. Nothing is sent to a server.</p>

      <form method="dialog">
        <button type="submit" className="btn btn--primary" autoFocus>
          Got it
        </button>
      </form>
    </dialog>
  )
}
