/*
 * Game content as plain data: what each shadow does and when each wave sends
 * them. Balancing the game means editing numbers here, not logic.
 */

export type EnemyKind = 'wisp' | 'dart' | 'brute' | 'splitter' | 'mote'

export interface EnemyStats {
  hp: number
  speed: number // world units per second
  radius: number
  damage: number // to the pedestal on contact
  score: number
  wobble: number // sideways drift while approaching
  windup?: number // darts: seconds of glowing in place before dashing
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  wisp: { hp: 1, speed: 0.55, radius: 0.32, damage: 10, score: 100, wobble: 0.45 },
  dart: { hp: 1, speed: 2.3, radius: 0.28, damage: 8, score: 150, wobble: 0, windup: 1.0 },
  brute: { hp: 3, speed: 0.33, radius: 0.5, damage: 25, score: 300, wobble: 0.15 },
  splitter: { hp: 2, speed: 0.5, radius: 0.4, damage: 12, score: 150, wobble: 0.3 },
  mote: { hp: 1, speed: 0.85, radius: 0.22, damage: 5, score: 50, wobble: 0.5 },
}

export const BOSS = {
  name: 'The Hollow Eye',
  hp: 24,
  radius: 0.75,
  y: 3.6,
  enterTime: 2.5,
  sway: 2.6, // horizontal drift amplitude
  swayPeriod: 10,
  attackInterval: [3.2, 2.2], // [phase 1, phase 2 (below half health)]
  orbSpeed: 0.95,
  orbRadius: 0.22,
  orbDamage: 12,
  orbScore: 50,
  summonAtHp: [16, 8], // summons wisps when health drops to these values
  summonCount: 3,
  score: 5000,
}

export type Side = 'left' | 'right' | 'top'
export type SpawnKind = EnemyKind | 'boss' | 'nova'

export interface SpawnEntry {
  at: number // seconds after the wave starts
  kind: SpawnKind
  side?: Side
}

export interface WaveDef {
  name: string
  spawns: SpawnEntry[]
  /** A ward crystal appears after this wave is cleared. */
  reward?: 'ward'
  boss?: boolean
}

/** `count` spawns of `kind`, starting at `start`, every `interval` seconds, cycling through `sides`. */
function stream(kind: EnemyKind, count: number, start: number, interval: number, sides: Side[]): SpawnEntry[] {
  return Array.from({ length: count }, (_, i) => ({ at: start + i * interval, kind, side: sides[i % sides.length] }))
}

const at = (time: number, kind: SpawnKind, side?: Side): SpawnEntry => ({ at: time, kind, side })

const sorted = (entries: SpawnEntry[]) => [...entries].sort((a, b) => a.at - b.at)

export const WAVES: WaveDef[] = [
  {
    name: 'First Shadows',
    spawns: sorted(stream('wisp', 6, 1.5, 2.8, ['left', 'right'])),
  },
  {
    name: 'Swift Ones',
    spawns: sorted([...stream('wisp', 6, 1, 2.6, ['right', 'left', 'top']), ...stream('dart', 4, 4, 5, ['top', 'left', 'right'])]),
    reward: 'ward',
  },
  {
    name: 'Heavy Steps',
    spawns: sorted([
      ...stream('brute', 3, 1, 7, ['left', 'right', 'top']),
      ...stream('wisp', 8, 2.5, 2.2, ['right', 'top', 'left']),
      at(10, 'nova'),
    ]),
  },
  {
    name: 'Many From One',
    spawns: sorted([
      ...stream('splitter', 4, 1, 5, ['left', 'right']),
      ...stream('dart', 4, 3, 5.5, ['top', 'right', 'left']),
      ...stream('wisp', 6, 2, 3, ['top', 'left', 'right']),
      at(12, 'nova'),
    ]),
    reward: 'ward',
  },
  {
    name: BOSS.name,
    spawns: [at(1, 'boss'), at(15, 'nova'), at(40, 'nova')],
    boss: true,
  },
]
