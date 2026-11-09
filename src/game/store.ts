import { useSyncExternalStore } from 'react'
import type { CameraErrorInfo } from '../vision/cameraErrors'
import type { Phase, ShardKind } from './world'

export type Screen = 'title' | 'play'
export type ControlMode = 'mouse' | 'webcam'
export type CameraStatus = 'off' | 'requesting' | 'loading-model' | 'ready' | 'error'
export type PauseReason = 'menu' | 'hand' | 'hidden'

/**
 * UI-facing state. Values that change every frame (positions) are NOT stored
 * here; they live in the World and are read inside the render loop. This store
 * only holds what the HTML overlay shows, and it only notifies React when a
 * value actually changes.
 */
export interface GameState {
  screen: Screen
  mode: ControlMode
  showHowTo: boolean
  showDebug: boolean
  muted: boolean

  // Camera / hand tracking
  camera: CameraStatus
  cameraError: CameraErrorInfo | null
  /** Bumped to retry starting the camera after an error. */
  cameraAttempt: number
  delegate: 'GPU' | 'CPU' | null
  trackingFps: number
  handDetected: boolean
  pinching: boolean
  pinchRatio: number | null

  // Game
  phase: Phase
  wave: number
  waveName: string
  waveCount: number
  bossWave: boolean
  hp: number
  maxHp: number
  shielded: boolean
  score: number
  multiplier: number
  best: number
  newBest: boolean
  waveBonus: number
  bossHp: number
  bossMaxHp: number
  enemies: number
  held: ShardKind | null
  hovering: boolean
  nearSocket: boolean
  paused: boolean
  pauseReason: PauseReason | null
  /** Bumped on every new run so scene effects can clear themselves. */
  runCount: number
}

export const initialState: GameState = {
  screen: 'title',
  mode: 'mouse',
  showHowTo: false,
  showDebug: false,
  muted: false,
  camera: 'off',
  cameraError: null,
  cameraAttempt: 0,
  delegate: null,
  trackingFps: 0,
  handDetected: false,
  pinching: false,
  pinchRatio: null,
  phase: 'intro',
  wave: 1,
  waveName: '',
  waveCount: 5,
  bossWave: false,
  hp: 100,
  maxHp: 100,
  shielded: false,
  score: 0,
  multiplier: 1,
  best: 0,
  newBest: false,
  waveBonus: 0,
  bossHp: 0,
  bossMaxHp: 0,
  enemies: 0,
  held: null,
  hovering: false,
  nearSocket: false,
  paused: false,
  pauseReason: null,
  runCount: 0,
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
