import { Canvas } from '@react-three/fiber'
import { Component, useEffect, useRef, type ReactNode } from 'react'
import { pointerInput, resetGame } from './game/session'
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
  const stageRef = useRef<HTMLDivElement>(null)
  const playing = screen === 'play'

  useMouseControls(playing && mode === 'mouse', stageRef, pointerInput)
  useKeyboardShortcuts(playing)

  return (
    <div className={`app app--${screen} app--${mode}`}>
      <div ref={stageRef} className="stage" data-testid="stage">
        <SceneErrorBoundary>
          <Canvas
            dpr={[1, 2]}
            camera={{ fov: 42, near: 0.1, far: 80, position: [-2.3, 3, 10] }}
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

/** D toggles the status panel, R resets (only while playing). */
function useKeyboardShortcuts(playing: boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'd' || e.key === 'D') gameStore.set({ showDebug: !gameStore.get().showDebug })
      if (playing && (e.key === 'r' || e.key === 'R')) resetGame()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing])
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
