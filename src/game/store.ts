import { useSyncExternalStore } from 'react'
import type { CrystalState } from './interaction'
import type { CameraErrorInfo } from '../vision/cameraErrors'

export type Screen = 'title' | 'play'
export type ControlMode = 'mouse' | 'webcam'
export type CameraStatus = 'off' | 'requesting' | 'loading-model' | 'ready' | 'error'

/**
 * UI-facing state. Values that change every frame (positions) are NOT stored
 * here; they live in plain objects read inside the render loop. This store only
 * holds things the HTML overlay needs, and it only notifies React when a value
 * actually changes.
 */
export interface GameState {
  screen: Screen
  mode: ControlMode
  showHowTo: boolean
  showDebug: boolean

  camera: CameraStatus
  cameraError: CameraErrorInfo | null
  /** Bumped to retry starting the camera after an error. */
  cameraAttempt: number
  delegate: 'GPU' | 'CPU' | null
  trackingFps: number

  handDetected: boolean
  pinching: boolean
  pinchRatio: number | null

  crystal: CrystalState
  /** A grabbed crystal is over the pedestal and will be placed if released. */
  nearSocket: boolean
  completed: boolean
  /** Bumped each time the crystal is placed, to trigger the particle burst. */
  completionCount: number
  /** Bumped on reset so scene effects can clear themselves. */
  resetCount: number
}

export const initialState: GameState = {
  screen: 'title',
  mode: 'mouse',
  showHowTo: false,
  showDebug: false,
  camera: 'off',
  cameraError: null,
  cameraAttempt: 0,
  delegate: null,
  trackingFps: 0,
  handDetected: false,
  pinching: false,
  pinchRatio: null,
  crystal: 'idle',
  nearSocket: false,
  completed: false,
  completionCount: 0,
  resetCount: 0,
}

type Listener = () => void

export class Store<T extends object> {
  private state: T
  private listeners = new Set<Listener>()

  constructor(initial: T) {
    this.state = initial
  }

  get = (): T => this.state

  set = (patch: Partial<T>): void => {
    let changed = false
    for (const key in patch) {
      if (!Object.is(this.state[key], patch[key])) {
        changed = true
        break
      }
    }
    if (!changed) return
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export const gameStore = new Store<GameState>(initialState)

/** React hook: re-renders only when the selected value changes. */
export function useGame<K>(selector: (state: GameState) => K): K {
  return useSyncExternalStore(gameStore.subscribe, () => selector(gameStore.get()))
}
