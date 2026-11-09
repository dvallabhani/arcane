import type { Vec2 } from './math'

/*
 * Layout of the chamber. Everything the player interacts with lives on one
 * vertical plane (z = 0) that faces the camera. Mouse and hand input are both
 * projected onto that plane, so the game logic only ever deals with 2D points.
 */

/** Where the heart crystal floats before the pedestal is awakened. */
export const CRYSTAL_START: Vec2 = { x: -2.6, y: 1.9 }

/** The pedestal stands in the middle of the chamber; shadows come at it from every side. */
export const PEDESTAL_X = 0
export const PEDESTAL_TOP_Y = 1.18

/** Where a crystal rests once it is placed on the pedestal. */
export const SOCKET: Vec2 = { x: PEDESTAL_X, y: 1.98 }

/** An enemy (or dark orb) touching this circle damages the pedestal. */
export const PEDESTAL_HIT = { x: PEDESTAL_X, y: 1.7, radius: 0.85 }

/** Held crystals can't leave this box (keeps them on screen and above the floor). */
export const BOUNDS = { minX: -4.6, maxX: 4.6, minY: 0.75, maxY: 4.4 }

/** Floating wells that keep producing crystal shards (your ammunition). */
export const WELLS: Vec2[] = [
  { x: -3.5, y: 1.15 },
  { x: 3.5, y: 1.15 },
  { x: -2.3, y: 3.5 },
  { x: 2.3, y: 3.5 },
]

/** Where ward and nova crystals appear (alternating). */
export const SPECIAL_SPOTS: Vec2[] = [
  { x: -1.5, y: 0.95 },
  { x: 1.5, y: 0.95 },
]

/** Where shadows enter the chamber. */
export const SPAWN = { sideX: 5.4, topY: 5.0, minY: 1.0, maxY: 3.9, topSpreadX: 3.6 }

export const TUNING = {
  maxHp: 100,

  // Grabbing
  hoverEnter: 0.62, // cursor must come this close to a crystal to highlight it...
  hoverExit: 0.9, // ...and move this far away to un-highlight it (hysteresis)
  snapRadius: 0.95, // releasing a special crystal this close to the socket places it
  followSpeed: 18, // how quickly a held crystal catches up with the cursor
  snapSpeed: 7, // how quickly a placed crystal glides into the socket

  // Smashing and throwing
  shardRadius: 0.26,
  shardMaxHits: 3, // a held shard shatters after this many hits
  smashCooldown: 0.4, // seconds before the same shard can hit the same target again
  knockback: 3,
  throwMinSpeed: 3.2, // releasing faster than this (units/s) throws the shard
  throwRestTime: 0.25, // ...unless the hand had stopped for this long before letting go
  throwBoost: 1.25,
  throwMinLaunch: 7,
  throwMaxLaunch: 13,
  aimAssistCone: Math.cos((30 * Math.PI) / 180),
  aimAssistBlend: 0.6,
  homingRange: 4,
  homingCone: Math.cos((35 * Math.PI) / 180),
  homingTurn: 2.5, // radians per second
  flightTime: 1.6,

  // Shard supply
  wellRespawn: 1.2,
  dropReturnDelay: 1.5, // a dropped shard drifts back to its well after this long
  dropReturnSpeed: 2,

  // Scoring
  comboWindow: 2.5, // kills closer together than this build a combo
  waveBonus: 250, // x wave number
  flawlessBonus: 500, // wave cleared without taking damage
  hpBonus: 25, // x remaining pedestal health at victory

  // Special crystals
  wardHeal: 30,
  wardShield: 5,
  novaRadius: 4.2,
  novaBossDamage: 3,

  // Pacing (seconds)
  awakenedTime: 3,
  waveIntroTime: 2.5,
  waveClearTime: 2.5,
  bossDeathTime: 2.5,
}
