import { describe, expect, it } from 'vitest'
import { CRYSTAL_START, PEDESTAL_HIT, SOCKET, TUNING, WELLS } from './constants'
import { BOSS, ENEMIES, WAVES } from './content'
import type { Vec2 } from './math'
import { World, type GameEvent } from './world'

const DT = 1 / 60

/** Runs the world for `seconds` with a constant input and returns every event. */
function tick(w: World, pointer: Vec2 | null, grip: boolean, seconds = DT): GameEvent[] {
  const events: GameEvent[] = []
  const frames = Math.max(1, Math.round(seconds / DT))
  for (let i = 0; i < frames; i++) events.push(...w.update({ pointer, grip }, DT))
  return events
}

const types = (events: GameEvent[]) => events.map((e) => e.type)

/** Moves the cursor along a straight line over `seconds`, gripping or not. */
function sweep(w: World, from: Vec2, to: Vec2, grip: boolean, seconds: number): GameEvent[] {
  const events: GameEvent[] = []
  const frames = Math.round(seconds / DT)
  for (let i = 1; i <= frames; i++) {
    const t = i / frames
    events.push(...w.update({ pointer: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, grip }, DT))
  }
  return events
}

/** Grabs whatever is at `at` (hover first, then press). */
function grab(w: World, at: Vec2): GameEvent[] {
  return [...tick(w, at, false), ...tick(w, at, true)]
}

function awaken(w: World): GameEvent[] {
  const events = grab(w, CRYSTAL_START)
  events.push(...sweep(w, CRYSTAL_START, SOCKET, true, 1))
  events.push(...tick(w, SOCKET, true, 0.3)) // hold still before letting go
  events.push(...tick(w, SOCKET, false))
  return events
}

/** Skips to wave n and plays through its intro so enemies start arriving. */
function startWave(w: World, n: number): void {
  w.debugSkipToWave(n)
  tick(w, null, false, TUNING.waveIntroTime + 0.05)
  expect(w.phase).toBe('wave')
}

const freshWorld = () => new World(42)

describe('intro: awakening the pedestal', () => {
  it('starts with only the heart crystal and no ammunition', () => {
    const w = freshWorld()
    expect(w.phase).toBe('intro')
    expect(w.shards.map((s) => s.kind)).toEqual(['heart'])
  })

  it('carrying the heart to the pedestal awakens it, then wave 1 begins and the wells fill', () => {
    const w = freshWorld()
    expect(types(awaken(w))).toContain('awaken')
    expect(w.phase).toBe('awakened')
    expect(w.heart?.state).toBe('socketed')

    const events = tick(w, null, false, TUNING.awakenedTime + 1)
    expect(events).toContainEqual(expect.objectContaining({ type: 'wave-start', wave: 1, name: WAVES[0].name }))
    expect(w.shards.filter((s) => s.kind === 'shard')).toHaveLength(WELLS.length)
  })

  it('dropping the heart away from the pedestal keeps the intro going', () => {
    const w = freshWorld()
    grab(w, CRYSTAL_START)
    sweep(w, CRYSTAL_START, { x: -1, y: 3 }, true, 0.8)
    tick(w, { x: -1, y: 3 }, true, 0.3)
    expect(types(tick(w, { x: -1, y: 3 }, false))).toContain('drop')
    expect(w.phase).toBe('intro')
  })

  it('a press and release replayed between frames (instant drag) still places the heart', () => {
    const w = freshWorld()
    w.update({ pointer: CRYSTAL_START, grip: false }, DT)
    w.update({ pointer: CRYSTAL_START, grip: true }, 0)
    expect(types(w.update({ pointer: SOCKET, grip: false }, 0))).toContain('awaken')
  })

  it('the heart cannot be picked up again once it is in the socket', () => {
    const w = freshWorld()
    awaken(w)
    tick(w, SOCKET, false, 1)
    expect(types(grab(w, SOCKET))).not.toContain('grab')
  })
})

describe('crystal shards', () => {
  const ready = () => {
    const w = freshWorld()
    w.debugSkipToWave(1)
    tick(w, null, false, 0.5) // wells refill
    return w
  }

  it('can be grabbed from a well', () => {
    const w = ready()
    expect(types(grab(w, WELLS[0]))).toContain('grab')
    expect(w.held?.kind).toBe('shard')
  })

  it('a slow release drops the shard, which then drifts back to its well', () => {
    const w = ready()
    grab(w, WELLS[0])
    const spot = { x: -1.5, y: 2.5 }
    sweep(w, WELLS[0], spot, true, 1)
    tick(w, spot, true, 0.3)
    expect(types(tick(w, spot, false))).toContain('drop')
    tick(w, { x: 4, y: 4 }, false, TUNING.dropReturnDelay + 3)
    const shard = w.shards.find((s) => s.well === 0)!
    expect(shard.x).toBeCloseTo(WELLS[0].x, 1)
    expect(shard.y).toBeCloseTo(WELLS[0].y, 1)
  })

  it('a fast release throws it; the well then refills', () => {
    const w = ready()
    grab(w, WELLS[0])
    const events = sweep(w, WELLS[0], { x: -1.5, y: 2 }, true, 0.25) // ~8 units/s
    events.push(...tick(w, { x: -1.5, y: 2 }, false))
    expect(types(events)).toContain('throw')
    expect(w.shards.find((s) => s.state === 'flying')).toBeDefined()

    tick(w, null, false, TUNING.flightTime + TUNING.wellRespawn + 0.2)
    expect(w.shards.filter((s) => s.well === 0 && s.state === 'resting')).toHaveLength(1)
  })

  it('throws still register at a low frame rate (samples far apart)', () => {
    const w = ready()
    grab(w, WELLS[0])
    // 8 fps: one sample every 125 ms, moving 1 unit per frame, released right after the last move.
    for (let i = 1; i <= 3; i++) w.update({ pointer: { x: WELLS[0].x + i, y: WELLS[0].y + i * 0.5 }, grip: true }, 0.125)
    expect(types(w.update({ pointer: { x: WELLS[0].x + 3, y: WELLS[0].y + 1.5 }, grip: false }, 0))).toContain('throw')
  })

  it('a thrown shard destroys a shadow, with aim assist for slightly-off throws', () => {
    const w = freshWorld()
    startWave(w, 1)
    w.enemies = []
    const wisp = w.spawnEnemy('wisp', 'left', { x: 0.5, y: 3.6 })
    grab(w, WELLS[0])
    // Throw toward the upper right, not exactly at the wisp.
    sweep(w, WELLS[0], { x: -2.5, y: 2.2 }, true, 0.12)
    const events = tick(w, { x: -2.5, y: 2.2 }, false)
    events.push(...tick(w, null, false, 1.2))
    expect(events).toContainEqual(expect.objectContaining({ type: 'kill', kind: 'wisp' }))
    expect(wisp.dead).toBe(true)
    expect(w.score).toBeGreaterThan(0)
  })

  it('a held shard smashes shadows and shatters after three hits', () => {
    const w = freshWorld()
    startWave(w, 3)
    w.enemies = []
    const brute = w.spawnEnemy('brute', 'left', { x: -3.5, y: 2.6 })
    grab(w, WELLS[0])
    const events: GameEvent[] = []
    // Keep pressing the shard into the brute; the smash cooldown spaces out the hits.
    for (let i = 0; i < 120 && w.held; i++) events.push(...tick(w, { x: brute.x, y: brute.y }, true))
    expect(types(events).filter((t) => t === 'smash')).toHaveLength(TUNING.shardMaxHits)
    expect(types(events)).toContain('shard-shatter')
    expect(brute.dead).toBe(true) // brutes take exactly 3 hits
    expect(w.held).toBeUndefined()
  })
})

describe('shadows', () => {
  it('a wisp that reaches the pedestal damages it', () => {
    const w = freshWorld()
    startWave(w, 1)
    w.enemies = []
    w.spawnEnemy('wisp', 'left', { x: PEDESTAL_HIT.x - 1.6, y: PEDESTAL_HIT.y })
    const events = tick(w, null, false, 3)
    expect(events).toContainEqual(expect.objectContaining({ type: 'pedestal-hit', damage: ENEMIES.wisp.damage }))
    expect(w.hp).toBe(TUNING.maxHp - ENEMIES.wisp.damage)
  })

  it('darts hold still while glowing, then dash', () => {
    const w = freshWorld()
    startWave(w, 2)
    w.enemies = []
    const dart = w.spawnEnemy('dart', 'top', { x: 0, y: 4.5 })
    tick(w, null, false, (ENEMIES.dart.windup ?? 0) - 0.1)
    expect(dart.y).toBeCloseTo(4.5, 2)
    tick(w, null, false, 0.4)
    expect(dart.y).toBeLessThan(4.0)
  })

  it('splitters break into two motes', () => {
    const w = freshWorld()
    startWave(w, 4)
    w.enemies = []
    w.spawnEnemy('splitter', 'left', { x: -3.5, y: 2.6 })
    grab(w, WELLS[0])
    for (let i = 0; i < 90 && w.enemies.some((e) => e.kind === 'splitter'); i++) tick(w, { x: -3.5, y: 2.6 }, true)
    expect(w.enemies.filter((e) => e.kind === 'mote')).toHaveLength(2)
  })

  it('the ward shield blocks damage', () => {
    const w = freshWorld()
    startWave(w, 1)
    w.enemies = []
    w.shieldTime = 10
    w.spawnEnemy('wisp', 'left', { x: PEDESTAL_HIT.x - 1.4, y: PEDESTAL_HIT.y })
    expect(types(tick(w, null, false, 3))).toContain('shield-block')
    expect(w.hp).toBe(TUNING.maxHp)
  })
})

describe('waves and special crystals', () => {
  it('clearing a wave awards a bonus (plus flawless bonus) and introduces the next wave', () => {
    const w = freshWorld()
    startWave(w, 1)
    // Fast-forward through the spawn schedule, removing shadows as they appear.
    const events: GameEvent[] = []
    for (let i = 0; i < 60 * 30 && w.phase === 'wave'; i++) {
      events.push(...tick(w, null, false))
      w.enemies = []
    }
    const clear = events.find((e) => e.type === 'wave-clear')
    expect(clear).toEqual({ type: 'wave-clear', wave: 1, bonus: TUNING.waveBonus + TUNING.flawlessBonus })
    tick(w, null, false, TUNING.waveClearTime + 0.1)
    expect(w.phase).toBe('wave-intro')
    expect(w.waveIndex).toBe(1)
  })

  it('a ward appears after wave 2; placing it heals and shields the pedestal', () => {
    const w = freshWorld()
    startWave(w, 2)
    for (let i = 0; i < 60 * 40 && w.phase === 'wave'; i++) {
      tick(w, null, false)
      w.enemies = []
    }
    const ward = w.shards.find((s) => s.kind === 'ward')!
    expect(ward).toBeDefined()
    w.debugSetHp(50)
    grab(w, ward)
    sweep(w, ward, SOCKET, true, 1)
    tick(w, SOCKET, true, 0.3)
    expect(types(tick(w, SOCKET, false))).toContain('ward')
    expect(w.hp).toBe(50 + TUNING.wardHeal)
    expect(w.shieldTime).toBeGreaterThan(0)
  })

  it('a nova placed on the pedestal destroys nearby shadows', () => {
    const w = freshWorld()
    startWave(w, 3)
    tick(w, null, false, 10.1) // the nova appears at 10 s
    w.enemies = []
    const near = [w.spawnEnemy('wisp', 'left', { x: -2, y: 2.5 }), w.spawnEnemy('brute', 'right', { x: 2, y: 3 })]
    const far = w.spawnEnemy('wisp', 'left', { x: -5.4, y: 4 })
    const nova = w.shards.find((s) => s.kind === 'nova')!
    expect(nova).toBeDefined()
    grab(w, nova)
    sweep(w, nova, SOCKET, true, 0.6)
    tick(w, SOCKET, true, 0.3)
    expect(types(tick(w, SOCKET, false))).toContain('nova')
    expect(near.every((e) => e.dead)).toBe(true)
    expect(far.dead).toBe(false)
  })
})

describe('the boss', () => {
  const bossWave = () => {
    const w = freshWorld()
    startWave(w, 5)
    tick(w, null, false, 1.1 + BOSS.enterTime + 0.1) // spawns at 1 s, then enters
    expect(w.boss?.state).toBe('active')
    return w
  }

  it('fires dark orbs that damage the pedestal', () => {
    const w = bossWave()
    const events = tick(w, null, false, BOSS.attackInterval[0] + 0.1)
    expect(types(events)).toContain('boss-attack')
    expect(w.orbs.length).toBeGreaterThan(0)
    const more = tick(w, null, false, 4)
    expect(more).toContainEqual(expect.objectContaining({ type: 'pedestal-hit', damage: BOSS.orbDamage }))
  })

  it('summons wisps as it weakens', () => {
    const w = bossWave()
    w.enemies = []
    w.debugDamageBoss(BOSS.hp - BOSS.summonAtHp[0])
    expect(w.enemies.filter((e) => e.kind === 'wisp')).toHaveLength(BOSS.summonCount)
  })

  it('defeating it clears the field and wins the game with a health bonus', () => {
    const w = bossWave()
    w.debugDamageBoss(BOSS.hp)
    expect(w.boss?.state).toBe('dying')
    const events = tick(w, null, false, 3)
    expect(w.phase).toBe('victory')
    const victory = events.find((e) => e.type === 'victory')
    expect(victory).toBeDefined()
    expect(w.score).toBeGreaterThanOrEqual(BOSS.score + w.hp * TUNING.hpBonus)
  })
})

describe('scoring, defeat and pause', () => {
  it('quick successive kills build a combo multiplier that later resets', () => {
    const w = freshWorld()
    startWave(w, 3)
    tick(w, null, false, 0.5)
    w.enemies = []
    // Three wisps sitting on one well, a fourth on another.
    for (let i = 0; i < 3; i++) w.spawnEnemy('wisp', 'left', { x: WELLS[0].x, y: WELLS[0].y + 0.1 })
    w.spawnEnemy('wisp', 'left', { x: WELLS[1].x, y: WELLS[1].y + 0.1 })
    grab(w, WELLS[0])
    tick(w, WELLS[0], true, 0.1) // one hit per frame: three kills, then the shard shatters
    expect(w.combo).toBe(3)
    expect(w.multiplier).toBe(1)
    tick(w, WELLS[1], false)
    grab(w, WELLS[1])
    tick(w, WELLS[1], true, 0.1)
    expect(w.combo).toBe(4)
    expect(w.multiplier).toBe(2)
    tick(w, null, false, TUNING.comboWindow + 0.1)
    expect(w.multiplier).toBe(1)
  })

  it('the game is lost when the pedestal runs out of health', () => {
    const w = freshWorld()
    startWave(w, 1)
    w.debugSetHp(5)
    w.enemies = []
    w.spawnEnemy('wisp', 'left', { x: PEDESTAL_HIT.x - 1.4, y: PEDESTAL_HIT.y })
    const events = tick(w, null, false, 3)
    expect(events).toContainEqual(expect.objectContaining({ type: 'defeat', wave: 1 }))
    expect(w.phase).toBe('defeat')
    expect(types(grab(w, WELLS[1]))).not.toContain('grab')
  })

  it('nothing moves while paused, and resuming mid-pinch does not grab', () => {
    const w = freshWorld()
    startWave(w, 1)
    w.enemies = []
    const wisp = w.spawnEnemy('wisp', 'left', { x: -4, y: 2 })
    w.paused = true
    tick(w, WELLS[0], true, 2)
    expect(wisp.x).toBe(-4)
    w.paused = false
    tick(w, WELLS[0], true)
    expect(w.held).toBeUndefined()
  })

  it('losing the hand mid-flick throws the shard; losing it while still drops it', () => {
    const flick = freshWorld()
    flick.debugSkipToWave(1)
    tick(flick, null, false, 0.5)
    grab(flick, WELLS[0])
    sweep(flick, WELLS[0], { x: -1.5, y: 2 }, true, 0.2)
    expect(types(tick(flick, null, true))).toContain('throw')

    const still = freshWorld()
    still.debugSkipToWave(1)
    tick(still, null, false, 0.5)
    grab(still, WELLS[0])
    tick(still, WELLS[0], true, 0.5)
    expect(types(tick(still, null, true))).toContain('drop')
  })

  it('reset starts a fresh run', () => {
    const w = freshWorld()
    startWave(w, 3)
    w.score = 999
    w.reset()
    expect(w.phase).toBe('intro')
    expect(w.score).toBe(0)
    expect(w.hp).toBe(TUNING.maxHp)
    expect(w.shards.map((s) => s.kind)).toEqual(['heart'])
  })
})
