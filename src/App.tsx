import { Canvas } from '@react-three/fiber'
import { Component, useEffect, useRef, type ReactNode } from 'react'
import { clearEffects } from './scene/effects'
import { pause, pointerInput, resume, toggleMute, togglePause, world } from './game/session'
import { gameStore, useGame } from './game/store'
import { useMouseControls } from './game/useMouseControls'
import { Experience } from './scene/Experience'
import { HowToPlay } from './ui/HowToPlay'
import { Hud } from './ui/Hud'
import { TitleScreen } from './ui/TitleScreen'
import { WebcamPanel } from './ui/WebcamPanel'

export default function App() {
  const screen = useGame((s) => s.screen)
  const mode = useGame((s) => s.mode)
  const showHowTo = useGame((s) => s.showHowTo)
  const runCount = useGame((s) => s.runCount)
  const stageRef = useRef<HTMLDivElement>(null)
  const playing = screen === 'play'

  useMouseControls(playing && mode === 'mouse', stageRef, pointerInput)
  useKeyboardShortcuts(playing)
  useAutoPause()
  useEffect(() => clearEffects(), [runCount]) // a new run starts with a clean scene

  return (
    <div className={`app app--${screen} app--${mode}`}>
      <div ref={stageRef} className="stage" data-testid="stage">
        <SceneErrorBoundary>
          <Canvas
            dpr={[1, 2]}
            camera={{ fov: 42, near: 0.1, far: 80, position: [-1.8, 3, 10] }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
          >
            <Experience />
          </Canvas>
        </SceneErrorBoundary>
      </div>

      {playing ? <Hud /> : <TitleScreen />}
      {playing && mode === 'webcam' && <WebcamPanel />}
      {showHowTo && <HowToPlay />}
    </div>
  )
}

/** Esc / P pause, M mute, D status panel. */
function useKeyboardShortcuts(playing: boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || gameStore.get().showHowTo) return
      const key = e.key.toLowerCase()
      if (key === 'd') gameStore.set({ showDebug: !gameStore.get().showDebug })
      if (!playing) return
      if (key === 'escape' || key === 'p') togglePause()
      if (key === 'm') toggleMute()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing])
}

/**
 * Pauses during a wave when the tab is hidden, or (webcam mode) when the hand
 * has been out of view for a moment, and resumes by itself when the hand
 * returns. Losing tracking shouldn't cost the player the pedestal.
 */
function useAutoPause() {
  const screen = useGame((s) => s.screen)
  const mode = useGame((s) => s.mode)
  const camera = useGame((s) => s.camera)
  const hand = useGame((s) => s.handDetected)
  const phase = useGame((s) => s.phase)
  const paused = useGame((s) => s.paused)
  const reason = useGame((s) => s.pauseReason)

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && gameStore.get().screen === 'play' && world.phase === 'wave') pause('hidden')
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (screen !== 'play' || mode !== 'webcam' || camera !== 'ready') return
    if (!hand && !paused && phase === 'wave') {
      const timer = window.setTimeout(() => pause('hand'), 900)
      return () => window.clearTimeout(timer)
    }
    if (hand && paused && reason === 'hand') {
      const timer = window.setTimeout(resume, 400)
      return () => window.clearTimeout(timer)
    }
  }, [screen, mode, camera, hand, phase, paused, reason])
}

/** If WebGL can't start (very old browser, disabled GPU), explain instead of showing a blank page. */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('[arcane] 3D scene failed to start', error)
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="notice notice--error" role="alert">
          <p className="notice__title">3D graphics are unavailable</p>
          <p className="notice__text">
            Arcane needs WebGL. Try a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration
            turned on.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
