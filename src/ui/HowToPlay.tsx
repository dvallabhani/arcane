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
      <p className="howto__goal">Carry the crystal to the pedestal and let it go there.</p>

      <h3>With your webcam</h3>
      <ol>
        <li>Raise one hand so the camera can see your palm.</li>
        <li>Point at the crystal with your index finger. It brightens when you’re close enough.</li>
        <li>Pinch your thumb and index finger together to pick it up.</li>
        <li>Keep pinching while you move your hand over the pedestal.</li>
        <li>Open your fingers to let go.</li>
      </ol>
      <p className="howto__tip">
        Works best about an arm’s length from the camera with your hand lit from the front. The small preview in the
        corner shows what the tracker sees.
      </p>

      <h3>With a mouse, trackpad or touchscreen</h3>
      <p>Press on the crystal, drag it over the pedestal and release.</p>

      <h3>Your privacy</h3>
      <p>
        Camera frames are analysed by Google’s MediaPipe hand tracker running inside your browser. Nothing is sent to a
        server.
      </p>

      <form method="dialog">
        <button type="submit" className="btn btn--primary" autoFocus>
          Got it
        </button>
      </form>
    </dialog>
  )
}
