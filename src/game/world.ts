import { BOUNDS, CRYSTAL_START, PEDESTAL_HIT, SOCKET, SPAWN, SPECIAL_SPOTS, TUNING, WELLS } from './constants'
import { BOSS, ENEMIES, WAVES, type EnemyKind, type Side, type WaveDef } from './content'
import { clamp, damp, distance, type Vec2 } from './math'
import { createRng, randomBetween, type Rng } from './rng'

/*
 * The whole game, as plain data plus one update() function.
 *
 * Nothing in here knows about React, Three.js, the mouse or the webcam. Every
 * frame the scene calls update() with a cursor position on the play plane and
 * a "grip" flag (pinching / mouse button held). The scene then draws whatever
 * is in the arrays below, and plays sounds/effects for the returned events.
 */

export type ShardKind = 'heart' | 'shard' | 'ward' | 'nova'
export type ShardState = 'resting' | 'held' | 'flying' | 'socketed'

export interface Shard {
  id: number
  kind: ShardKind
  state: ShardState
  x: number
  y: number
  vx: number
  vy: number
  /** Where a resting shard drifts back to (its well, or where a special appeared). */
  home: Vec2
  /** Which well produced this shard (ammo only). */
  well: number | null
  hits: number
  age: number
  idle: number
  flight: number
  dead: boolean
}

export interface Enemy {
  id: number
  kind: EnemyKind
  x: number
  y: number
  hp: number
  maxHp: number
  radius: number
  age: number
  phase: number
  dirX: number
  dirY: number
  /** Knockback velocity, decays quickly. */
  kx: number
  ky: number
  hitFlash: number
  hitCooldown: number
  dead: boolean
}

export interface Orb {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  age: number
  dead: boolean
}

export interface Boss {
  x: number
  y: number
  hp: number
  maxHp: number
  age: number
  state: 'entering' | 'active' | 'dying'
  attackTimer: number
  summonsDone: number
  hitFlash: number
  hitCooldown: number
  /** Brief glow before firing, so the attack can be anticipated. */
  charge: number
}

export type Phase = 'intro' | 'awakened' | 'wave-intro' | 'wave' | 'wave-clear' | 'victory' | 'defeat'

export type GameEvent =
  | { type: 'grab'; kind: ShardKind }
  | { type: 'drop'; kind: ShardKind }
  | { type: 'throw'; x: number; y: number }
  | { type: 'smash'; x: number; y: number }
  | { type: 'enemy-hit'; x: number; y: number; kind: EnemyKind }
  | { type: 'kill'; x: number; y: number; kind: EnemyKind; points: number }
  | { type: 'shard-shatter'; x: number; y: number }
  | { type: 'shard-spawn'; x: number; y: number; kind: ShardKind }
  | { type: 'enemy-spawn'; x: number; y: number; kind: EnemyKind }
  | { type: 'pedestal-hit'; damage: number; x: number; y: number }
  | { type: 'shield-block'; x: number; y: number }
  | { type: 'awaken' }
  | { type: 'ward' }
  | { type: 'nova'; radius: number }
  | { type: 'wave-start'; wave: number; name: string; boss: boolean }
  | { type: 'wave-clear'; wave: number; bonus: number }
  | { type: 'boss-spawn' }
  | { type: 'boss-hit'; x: number; y: number }
  | { type: 'boss-attack'; x: number; y: number }
  | { type: 'boss-defeated'; x: number; y: number }
  | { type: 'orb-destroyed'; x: number; y: number }
  | { type: 'victory'; score: number }
  | { type: 'defeat'; score: number; wave: number }

export interface WorldInput {
  /** Cursor on the play plane, or null when there is none (hand lost, mouse outside). */
  pointer: Vec2 | null
  /** Pinching / mouse button held. */
  grip: boolean
}

type Target = { kind: 'enemy'; enemy: Enemy } | { kind: 'orb'; orb: Orb } | { kind: 'boss'; boss: Boss }

const SPECIAL: ReadonlySet<ShardKind> = new Set(['heart', 'ward', 'nova'])

export class World {
  phase: Phase = 'intro'
  phaseTime = 0
  time = 0
  /** Index into WAVES of the current (or upcoming) wave. */
  waveIndex = 0
  paused = false

  hp: number = TUNING.maxHp
  shieldTime = 0
  pedestalFlash = 0

  shards: Shard[] = []
  enemies: Enemy[] = []
  orbs: Orb[] = []
  boss: Boss | null = null

  heldId: number | null = null
  hoveredId: number | null = null
  /** A held special crystal is over the socket and would be placed if released. */
  nearSocket = false

  score = 0
  combo = 0
  comboTimer = 0
  kills = 0
  waveDamage = 0
  lastWaveBonus = 0

  private rng: Rng
  private nextId = 1
  private spawnCursor = 0
  private wellTimers: number[] = []
  private specialSpot = 0
  private prevGrip = false
  /** Recent cursor positions while holding: each with the first and last time it was seen there. */
  private history: { x: number; y: number; first: number; last: number }[] = []
  private events: GameEvent[] = []

  constructor(seed = 1) {
    this.rng = createRng(seed)
    this.reset(seed)
  }

  /** Starts a fresh run: intro phase, heart crystal at its start position. */
  reset(seed?: number): void {
    if (seed !== undefined) this.rng = createRng(seed)
    this.phase = 'intro'
    this.phaseTime = 0
    this.time = 0
    this.waveIndex = 0
    this.paused = false
    this.hp = TUNING.maxHp
    this.shieldTime = 0
    this.pedestalFlash = 0
    this.shards = []
    this.enemies = []
    this.orbs = []
    this.boss = null
    this.heldId = null
    this.hoveredId = null
    this.nearSocket = false
    this.score = 0
    this.combo = 0
    this.comboTimer = 0
    this.kills = 0
    this.waveDamage = 0
    this.lastWaveBonus = 0
    this.spawnCursor = 0
    this.wellTimers = WELLS.map(() => -1)
    this.specialSpot = 0
    // A grip that is still held during a reset can't instantly grab: let go first.
    this.prevGrip = true
    this.history = []
    this.addShard('heart', CRYSTAL_START, null)
  }

  get wave(): WaveDef {
    return WAVES[this.waveIndex]
  }

  get held(): Shard | undefined {
    return this.heldId === null ? undefined : this.shards.find((s) => s.id === this.heldId)
  }

  get heart(): Shard | undefined {
    return this.shards.find((s) => s.kind === 'heart')
  }

  /** Score multiplier from the current combo: x1 for kills 1–3, x2 for 4–6, up to x4. */
  get multiplier(): number {
    return this.combo === 0 ? 1 : 1 + Math.min(3, Math.floor((this.combo - 1) / 3))
  }

  get isOver(): boolean {
    return this.phase === 'victory' || this.phase === 'defeat'
  }

  /** Advance the game by `dt` seconds. Returns what happened, for sounds and effects. */
  update(input: WorldInput, dt: number): GameEvent[] {
    this.events = []
    if (this.paused) {
      this.prevGrip = input.grip // resuming mid-pinch must not count as a new grab
      return this.events
    }
    this.time += dt
    this.phaseTime += dt

    this.handleInput(input, dt)
    this.updateShards(dt)
    this.updatePhase()

    if (this.phase === 'wave') {
      this.updateEnemies(dt)
      this.updateBoss(dt)
      this.updateOrbs(dt)
      this.cleanup()
    }

    this.comboTimer = Math.max(0, this.comboTimer - dt)
    if (this.comboTimer === 0) this.combo = 0
    this.shieldTime = Math.max(0, this.shieldTime - dt)
    this.pedestalFlash = Math.max(0, this.pedestalFlash - dt * 3)

    if (this.hp <= 0 && this.phase !== 'defeat' && this.phase !== 'victory') {
      this.hp = 0
      this.setPhase('defeat')
      this.dropHeld()
      this.events.push({ type: 'defeat', score: this.score, wave: this.waveIndex + 1 })
    }
    return this.events
  }

  // ---------------------------------------------------------------- input

  private handleInput({ pointer, grip }: WorldInput, dt: number): void {
    const gripStarted = grip && !this.prevGrip
    this.prevGrip = grip
    const held = this.held

    if (held) {
      if (pointer === null || !grip) {
        this.release(held, pointer === null ? null : this.clampToBounds(pointer))
        return
      }
      const target = this.clampToBounds(pointer)
      this.recordCursor(target)
      held.x = damp(held.x, target.x, TUNING.followSpeed, dt)
      held.y = damp(held.y, target.y, TUNING.followSpeed, dt)
      this.nearSocket = SPECIAL.has(held.kind) && this.canPlace(held) && (this.isOverSocket(held) || this.isOverSocket(target))
      if (held.kind === 'shard') this.smash(held)
      return
    }

    this.nearSocket = false
    if (pointer === null) {
      this.hoveredId = null
      return
    }

    // Hover: keep the current crystal while within the exit radius, otherwise
    // pick the nearest grabbable crystal inside the enter radius.
    const current = this.shards.find((s) => s.id === this.hoveredId && s.state === 'resting' && !s.dead)
    if (current && distance(pointer, current) < TUNING.hoverExit) {
      this.hoveredId = current.id
    } else {
      let best: Shard | null = null
      let bestDistance: number = TUNING.hoverEnter
      for (const s of this.shards) {
        if (s.dead || s.state !== 'resting' || !this.isGrabbable(s)) continue
        const d = distance(pointer, s)
        if (d < bestDistance) {
          best = s
          bestDistance = d
        }
      }
      this.hoveredId = best?.id ?? null
    }

    // A grab only starts at the *moment* the grip begins while hovering.
    if (gripStarted && this.hoveredId !== null) {
      const shard = this.shards.find((s) => s.id === this.hoveredId)!
      shard.state = 'held'
      shard.idle = 0
      this.heldId = shard.id
      this.history = []
      this.recordCursor(pointer)
      this.events.push({ type: 'grab', kind: shard.kind })
    }
  }

  private isGrabbable(s: Shard): boolean {
    if (this.isOver) return false
    return s.kind !== 'heart' || this.phase === 'intro'
  }

  private canPlace(s: Shard): boolean {
    return s.kind === 'heart' ? this.phase === 'intro' : true
  }

  /**
   * Letting go. In order of priority:
   *  1. a special crystal over the pedestal is placed,
   *  2. a shard moving fast enough is thrown,
   *  3. otherwise it is simply dropped where it is.
   */
  private release(shard: Shard, cursor: Vec2 | null): void {
    this.heldId = null
    this.nearSocket = false
    const overSocket = this.isOverSocket(shard) || (cursor !== null && this.isOverSocket(cursor))

    if (SPECIAL.has(shard.kind) && overSocket && this.canPlace(shard)) {
      this.place(shard)
      return
    }

    const v = this.releaseVelocity(cursor)
    const speed = Math.hypot(v.x, v.y)
    if (shard.kind === 'shard' && speed >= TUNING.throwMinSpeed) {
      this.launch(shard, v.x / speed, v.y / speed, speed)
      return
    }

    shard.state = 'resting'
    shard.idle = 0
    if (shard.kind !== 'shard') shard.home = { x: shard.x, y: shard.y } // specials stay where dropped
    this.events.push({ type: 'drop', kind: shard.kind })
  }

  /**
   * Remembers where the cursor is. Repeated identical positions (the same
   * frame replayed in several simulation steps, or a hand held still) extend
   * one sample instead of adding new ones, so a pause looks like a pause and
   * a fast move between two slow frames still looks fast.
   */
  private recordCursor(p: Vec2): void {
    const prev = this.history[this.history.length - 1]
    if (prev && Math.abs(prev.x - p.x) < 1e-4 && Math.abs(prev.y - p.y) < 1e-4) {
      prev.last = this.time
      return
    }
    this.history.push({ x: p.x, y: p.y, first: this.time, last: this.time })
    while (this.history.length > 2 && this.time - this.history[1].last > 0.4) this.history.shift()
  }

  /**
   * Velocity of the hand at release: zero if it had come to rest for a
   * moment (a deliberate drop), otherwise its speed over its last ~50 ms of
   * movement. Works the same at 60 fps and at 8 fps.
   */
  private releaseVelocity(cursor: Vec2 | null): Vec2 {
    if (cursor) this.recordCursor(cursor)
    const h = this.history
    if (h.length < 2) return { x: 0, y: 0 }
    const end = h[h.length - 1]
    if (this.time - end.first > TUNING.throwRestTime) return { x: 0, y: 0 }
    let start = h[0]
    for (let i = h.length - 2; i >= 0; i--) {
      if (end.first - h[i].last >= 0.05) {
        start = h[i]
        break
      }
    }
    const span = Math.max(end.first - start.last, 1 / 60)
    return { x: (end.x - start.x) / span, y: (end.y - start.y) / span }
  }

  private launch(shard: Shard, dx: number, dy: number, speed: number): void {
    // Gentle aim assist: bend the throw toward a target that is roughly in front.
    const target = this.findTarget(shard, dx, dy, 8, TUNING.aimAssistCone)
    if (target) {
      const p = targetPosition(target)
      const len = Math.hypot(p.x - shard.x, p.y - shard.y) || 1
      dx = dx * (1 - TUNING.aimAssistBlend) + ((p.x - shard.x) / len) * TUNING.aimAssistBlend
      dy = dy * (1 - TUNING.aimAssistBlend) + ((p.y - shard.y) / len) * TUNING.aimAssistBlend
      const n = Math.hypot(dx, dy) || 1
      dx /= n
      dy /= n
    }
    const launchSpeed = clamp(speed * TUNING.throwBoost, TUNING.throwMinLaunch, TUNING.throwMaxLaunch)
    shard.state = 'flying'
    shard.vx = dx * launchSpeed
    shard.vy = dy * launchSpeed
    shard.flight = 0
    this.events.push({ type: 'throw', x: shard.x, y: shard.y })
  }

  private place(shard: Shard): void {
    if (shard.kind === 'heart') {
      shard.state = 'socketed'
      this.setPhase('awakened')
      this.events.push({ type: 'awaken' })
      return
    }
    this.removeShard(shard)
    if (shard.kind === 'ward') {
      this.hp = Math.min(TUNING.maxHp, this.hp + TUNING.wardHeal)
      this.shieldTime = TUNING.wardShield
      this.events.push({ type: 'ward' })
    } else if (shard.kind === 'nova') {
      this.events.push({ type: 'nova', radius: TUNING.novaRadius })
      for (const e of this.enemies) {
        if (!e.dead && distance(e, SOCKET) < TUNING.novaRadius + e.radius) this.damageEnemy(e, e.hp)
      }
      for (const o of this.orbs) {
        if (!o.dead && distance(o, SOCKET) < TUNING.novaRadius) this.destroyOrb(o)
      }
      if (this.boss && distance(this.boss, SOCKET) < TUNING.novaRadius + BOSS.radius) {
        this.damageBoss(TUNING.novaBossDamage)
      }
    }
  }

  // ---------------------------------------------------------------- shards

  private updateShards(dt: number): void {
    for (const s of this.shards) {
      if (s.dead) continue
      s.age += dt
      if (s.state === 'socketed') {
        s.x = damp(s.x, SOCKET.x, TUNING.snapSpeed, dt)
        s.y = damp(s.y, SOCKET.y, TUNING.snapSpeed, dt)
      } else if (s.state === 'resting') {
        s.idle += dt
        if (s.kind === 'shard' && s.idle > TUNING.dropReturnDelay) {
          s.x = damp(s.x, s.home.x, TUNING.dropReturnSpeed, dt)
          s.y = damp(s.y, s.home.y, TUNING.dropReturnSpeed, dt)
        }
      } else if (s.state === 'flying') {
        this.updateFlight(s, dt)
      }
    }
    this.shards = this.shards.filter((s) => !s.dead)

    // Refill empty wells once the pedestal is awake.
    if (this.phase === 'intro' || this.isOver) return
    WELLS.forEach((well, i) => {
      if (this.wellTimers[i] < 0) return
      this.wellTimers[i] -= dt
      if (this.wellTimers[i] <= 0) {
        this.wellTimers[i] = -1
        this.addShard('shard', well, i)
      }
    })
  }

  private updateFlight(s: Shard, dt: number): void {
    s.flight += dt
    // Mild homing toward a target ahead of the shard.
    const speed = Math.hypot(s.vx, s.vy)
    const target = this.findTarget(s, s.vx / speed, s.vy / speed, TUNING.homingRange, TUNING.homingCone)
    if (target) {
      const p = targetPosition(target)
      const current = Math.atan2(s.vy, s.vx)
      const desired = Math.atan2(p.y - s.y, p.x - s.x)
      let delta = desired - current
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      const turn = clamp(delta, -TUNING.homingTurn * dt, TUNING.homingTurn * dt)
      s.vx = Math.cos(current + turn) * speed
      s.vy = Math.sin(current + turn) * speed
    }
    s.x += s.vx * dt
    s.y += s.vy * dt

    const hit = this.findOverlap(s.x, s.y, TUNING.shardRadius)
    if (hit) {
      this.hitTarget(hit)
      this.shatter(s)
      return
    }
    const margin = 1.5
    const outside = s.x < BOUNDS.minX - margin || s.x > BOUNDS.maxX + margin || s.y < 0 || s.y > BOUNDS.maxY + margin
    if (outside || s.flight > TUNING.flightTime) this.consume(s)
  }

  /** A held shard touching a shadow, an orb or the boss damages it. */
  private smash(shard: Shard): void {
    const hit = this.findOverlap(shard.x, shard.y, TUNING.shardRadius)
    if (!hit) return
    if (hit.kind === 'enemy') {
      const e = hit.enemy
      const dx = e.x - shard.x
      const dy = e.y - shard.y
      const len = Math.hypot(dx, dy) || 1
      e.kx += (dx / len) * TUNING.knockback
      e.ky += (dy / len) * TUNING.knockback
    }
    this.hitTarget(hit)
    this.events.push({ type: 'smash', x: shard.x, y: shard.y })
    shard.hits++
    if (shard.hits >= TUNING.shardMaxHits) {
      this.heldId = null
      this.shatter(shard)
    }
  }

  private shatter(s: Shard): void {
    this.events.push({ type: 'shard-shatter', x: s.x, y: s.y })
    this.consume(s)
  }

  /** Removes an ammo shard and starts its well's refill timer. */
  private consume(s: Shard): void {
    if (s.well !== null) this.wellTimers[s.well] = TUNING.wellRespawn
    this.removeShard(s)
  }

  private removeShard(s: Shard): void {
    s.dead = true // filtered out at the end of updateShards
    if (this.heldId === s.id) this.heldId = null
    if (this.hoveredId === s.id) this.hoveredId = null
  }

  private addShard(kind: ShardKind, at: Vec2, well: number | null): Shard {
    const shard: Shard = {
      id: this.nextId++,
      kind,
      state: 'resting',
      x: at.x,
      y: at.y,
      vx: 0,
      vy: 0,
      home: { ...at },
      well,
      hits: 0,
      age: 0,
      idle: 0,
      flight: 0,
      dead: false,
    }
    this.shards.push(shard)
    if (kind !== 'heart') this.events.push({ type: 'shard-spawn', x: at.x, y: at.y, kind })
    return shard
  }

  private spawnSpecial(kind: 'ward' | 'nova'): void {
    const spot = SPECIAL_SPOTS[this.specialSpot++ % SPECIAL_SPOTS.length]
    this.addShard(kind, spot, null)
  }

  private dropHeld(): void {
    const held = this.held
    if (held) {
      held.state = 'resting'
      this.heldId = null
    }
  }

  // ---------------------------------------------------------------- phases

  private setPhase(phase: Phase): void {
    this.phase = phase
    this.phaseTime = 0
  }

  private updatePhase(): void {
    switch (this.phase) {
      case 'awakened':
        if (this.phaseTime >= TUNING.awakenedTime) {
          WELLS.forEach((_, i) => (this.wellTimers[i] = 0.01 + i * 0.15)) // fill the wells one by one
          this.startWaveIntro()
        }
        break
      case 'wave-intro':
        if (this.phaseTime >= TUNING.waveIntroTime) this.startWave()
        break
      case 'wave':
        this.runSpawns()
        if (!this.wave.boss && this.spawnCursor >= this.wave.spawns.length && this.enemies.length === 0) {
          this.clearWave()
        }
        if (this.boss?.state === 'dying' && this.boss.age >= TUNING.bossDeathTime) this.win()
        break
      case 'wave-clear':
        if (this.phaseTime >= TUNING.waveClearTime) {
          this.waveIndex++
          this.startWaveIntro()
        }
        break
    }
  }

  private startWaveIntro(): void {
    this.setPhase('wave-intro')
    this.events.push({ type: 'wave-start', wave: this.waveIndex + 1, name: this.wave.name, boss: !!this.wave.boss })
  }

  private startWave(): void {
    this.setPhase('wave')
    this.spawnCursor = 0
    this.waveDamage = 0
  }

  private clearWave(): void {
    const bonus = TUNING.waveBonus * (this.waveIndex + 1) + (this.waveDamage === 0 ? TUNING.flawlessBonus : 0)
    this.score += bonus
    this.lastWaveBonus = bonus
    this.events.push({ type: 'wave-clear', wave: this.waveIndex + 1, bonus })
    if (this.wave.reward) this.spawnSpecial(this.wave.reward)
    this.setPhase('wave-clear')
  }

  private win(): void {
    const bonus = Math.round(this.hp * TUNING.hpBonus)
    this.score += bonus
    this.boss = null
    this.setPhase('victory')
    this.dropHeld()
    this.events.push({ type: 'victory', score: this.score })
  }

  private runSpawns(): void {
    const spawns = this.wave.spawns
    while (this.spawnCursor < spawns.length && spawns[this.spawnCursor].at <= this.phaseTime) {
      const entry = spawns[this.spawnCursor++]
      if (entry.kind === 'boss') this.spawnBoss()
      else if (entry.kind === 'nova') this.spawnSpecial('nova')
      else this.spawnEnemy(entry.kind, entry.side ?? 'left')
    }
  }

  // ---------------------------------------------------------------- enemies

  private spawnPoint(side: Side): Vec2 {
    if (side === 'top') return { x: randomBetween(this.rng, -SPAWN.topSpreadX, SPAWN.topSpreadX), y: SPAWN.topY }
    return { x: side === 'left' ? -SPAWN.sideX : SPAWN.sideX, y: randomBetween(this.rng, SPAWN.minY, SPAWN.maxY) }
  }

  spawnEnemy(kind: EnemyKind, side: Side, at?: Vec2): Enemy {
    const stats = ENEMIES[kind]
    const p = at ?? this.spawnPoint(side)
    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      x: p.x,
      y: p.y,
      hp: stats.hp,
      maxHp: stats.hp,
      radius: stats.radius,
      age: 0,
      phase: this.rng() * Math.PI * 2,
      dirX: 0,
      dirY: 0,
      kx: 0,
      ky: 0,
      hitFlash: 0,
      hitCooldown: 0,
      dead: false,
    }
    this.aim(enemy)
    this.enemies.push(enemy)
    this.events.push({ type: 'enemy-spawn', x: p.x, y: p.y, kind })
    return enemy
  }

  private aim(e: Enemy): void {
    const dx = PEDESTAL_HIT.x - e.x
    const dy = PEDESTAL_HIT.y - e.y
    const len = Math.hypot(dx, dy) || 1
    e.dirX = dx / len
    e.dirY = dy / len
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.dead) continue
      const stats = ENEMIES[e.kind]
      e.age += dt
      e.hitFlash = Math.max(0, e.hitFlash - dt * 4)
      e.hitCooldown = Math.max(0, e.hitCooldown - dt)

      let speed = stats.speed
      if (e.kind === 'dart') {
        // Darts glow in place, lock their aim, then dash in a straight line.
        if (e.age < (stats.windup ?? 0)) {
          speed = 0
          this.aim(e)
        }
      } else {
        this.aim(e)
      }
      const wobble = stats.wobble * Math.sin(e.age * 2.2 + e.phase)
      e.x += (e.dirX * speed - e.dirY * wobble + e.kx) * dt
      e.y += (e.dirY * speed + e.dirX * wobble + e.ky) * dt
      const decay = Math.exp(-6 * dt)
      e.kx *= decay
      e.ky *= decay

      if (Math.hypot(e.x - PEDESTAL_HIT.x, e.y - PEDESTAL_HIT.y) < PEDESTAL_HIT.radius + e.radius) {
        e.dead = true
        this.hitPedestal(stats.damage, e.x, e.y, stats.score / 2)
      }
    }
  }

  private damageEnemy(e: Enemy, amount: number): void {
    if (e.dead) return
    e.hp -= amount
    e.hitFlash = 1
    e.hitCooldown = TUNING.smashCooldown
    if (e.hp > 0) {
      this.events.push({ type: 'enemy-hit', x: e.x, y: e.y, kind: e.kind })
      return
    }
    e.dead = true
    const points = this.award(ENEMIES[e.kind].score)
    this.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind, points })
    if (e.kind === 'splitter') {
      for (const sign of [-1, 1]) {
        const mote = this.spawnEnemy('mote', 'left', { x: e.x - e.dirY * 0.35 * sign, y: e.y + e.dirX * 0.35 * sign })
        mote.kx = -e.dirY * 2 * sign
        mote.ky = e.dirX * 2 * sign
      }
    }
  }

  /** Adds points with the combo multiplier and extends the combo. */
  private award(base: number): number {
    this.kills++
    this.combo++
    this.comboTimer = TUNING.comboWindow
    const points = base * this.multiplier
    this.score += points
    return points
  }

  private hitPedestal(damage: number, x: number, y: number, shieldScore: number): void {
    if (this.shieldTime > 0) {
      this.score += Math.round(shieldScore)
      this.events.push({ type: 'shield-block', x, y })
      return
    }
    this.hp -= damage
    this.waveDamage += damage
    this.pedestalFlash = 1
    this.events.push({ type: 'pedestal-hit', damage, x, y })
  }

  // ---------------------------------------------------------------- boss

  private spawnBoss(): void {
    this.boss = {
      x: 0,
      y: BOSS.y + 2,
      hp: BOSS.hp,
      maxHp: BOSS.hp,
      age: 0,
      state: 'entering',
      attackTimer: BOSS.attackInterval[0],
      summonsDone: 0,
      hitFlash: 0,
      hitCooldown: 0,
      charge: 0,
    }
    this.events.push({ type: 'boss-spawn' })
  }

  private updateBoss(dt: number): void {
    const b = this.boss
    if (!b) return
    b.age += dt
    b.hitFlash = Math.max(0, b.hitFlash - dt * 4)
    b.hitCooldown = Math.max(0, b.hitCooldown - dt)

    if (b.state === 'entering') {
      b.y = damp(b.y, BOSS.y, 2, dt)
      if (b.age >= BOSS.enterTime) {
        b.state = 'active'
        b.age = 0
      }
      return
    }
    if (b.state === 'dying') return

    const enraged = b.hp <= b.maxHp / 2
    const period = enraged ? BOSS.swayPeriod * 0.7 : BOSS.swayPeriod
    b.x = BOSS.sway * Math.sin((b.age / period) * Math.PI * 2)
    b.y = BOSS.y + Math.sin(b.age * 1.3) * 0.15

    b.attackTimer -= dt
    b.charge = clamp(1 - b.attackTimer / 0.8, 0, 1) // glows during the last 0.8 s before firing
    if (b.attackTimer <= 0) {
      b.attackTimer = BOSS.attackInterval[enraged ? 1 : 0]
      this.fireOrbs(b, enraged ? [-0.35, 0, 0.35] : [0])
    }
  }

  private fireOrbs(b: Boss, spreads: number[]): void {
    const base = Math.atan2(PEDESTAL_HIT.y - b.y, PEDESTAL_HIT.x - b.x)
    for (const spread of spreads) {
      const angle = base + spread
      this.orbs.push({
        id: this.nextId++,
        x: b.x + Math.cos(angle) * BOSS.radius,
        y: b.y + Math.sin(angle) * BOSS.radius,
        vx: Math.cos(angle) * BOSS.orbSpeed,
        vy: Math.sin(angle) * BOSS.orbSpeed,
        age: 0,
        dead: false,
      })
    }
    this.events.push({ type: 'boss-attack', x: b.x, y: b.y })
  }

  private damageBoss(amount: number): void {
    const b = this.boss
    if (!b || b.state !== 'active') return
    b.hp = Math.max(0, b.hp - amount)
    b.hitFlash = 1
    b.hitCooldown = TUNING.smashCooldown
    this.events.push({ type: 'boss-hit', x: b.x, y: b.y })

    // Summon reinforcements at fixed health thresholds.
    while (b.summonsDone < BOSS.summonAtHp.length && b.hp <= BOSS.summonAtHp[b.summonsDone] && b.hp > 0) {
      b.summonsDone++
      for (let i = 0; i < BOSS.summonCount; i++) this.spawnEnemy('wisp', i % 2 === 0 ? 'left' : 'right')
    }

    if (b.hp === 0) {
      b.state = 'dying'
      b.age = 0
      this.score += BOSS.score
      this.events.push({ type: 'boss-defeated', x: b.x, y: b.y })
      for (const e of this.enemies) if (!e.dead) this.damageEnemy(e, e.hp)
      for (const o of this.orbs) if (!o.dead) this.destroyOrb(o)
    }
  }

  private updateOrbs(dt: number): void {
    for (const o of this.orbs) {
      if (o.dead) continue
      o.age += dt
      o.x += o.vx * dt
      o.y += o.vy * dt
      if (Math.hypot(o.x - PEDESTAL_HIT.x, o.y - PEDESTAL_HIT.y) < PEDESTAL_HIT.radius + BOSS.orbRadius) {
        o.dead = true
        this.hitPedestal(BOSS.orbDamage, o.x, o.y, BOSS.orbScore)
      } else if (o.age > 12) {
        o.dead = true
      }
    }
  }

  private destroyOrb(o: Orb): void {
    if (o.dead) return
    o.dead = true
    this.award(BOSS.orbScore)
    this.events.push({ type: 'orb-destroyed', x: o.x, y: o.y })
  }

  // ---------------------------------------------------------------- targets

  /** Anything a crystal can hit, at this point, that isn't on cooldown. */
  private findOverlap(x: number, y: number, radius: number): Target | null {
    for (const e of this.enemies) {
      if (!e.dead && e.hitCooldown === 0 && Math.hypot(e.x - x, e.y - y) < e.radius + radius) return { kind: 'enemy', enemy: e }
    }
    for (const o of this.orbs) {
      if (!o.dead && Math.hypot(o.x - x, o.y - y) < BOSS.orbRadius + radius) return { kind: 'orb', orb: o }
    }
    const b = this.boss
    if (b && b.state === 'active' && b.hitCooldown === 0 && Math.hypot(b.x - x, b.y - y) < BOSS.radius + radius) {
      return { kind: 'boss', boss: b }
    }
    return null
  }

  private hitTarget(target: Target): void {
    if (target.kind === 'enemy') this.damageEnemy(target.enemy, 1)
    else if (target.kind === 'orb') this.destroyOrb(target.orb)
    else this.damageBoss(1)
  }

  /** The best target within `range` whose direction is inside the cone around (dx, dy). */
  private findTarget(from: Vec2, dx: number, dy: number, range: number, minCos: number): Target | null {
    const candidates: Target[] = [
      ...this.enemies.filter((e) => !e.dead).map((enemy): Target => ({ kind: 'enemy', enemy })),
      ...this.orbs.filter((o) => !o.dead).map((orb): Target => ({ kind: 'orb', orb })),
      ...(this.boss?.state === 'active' ? [{ kind: 'boss', boss: this.boss } as Target] : []),
    ]
    let best: Target | null = null
    let bestScore = -Infinity
    for (const t of candidates) {
      const p = targetPosition(t)
      const ox = p.x - from.x
      const oy = p.y - from.y
      const d = Math.hypot(ox, oy)
      if (d === 0 || d > range) continue
      const cos = (ox * dx + oy * dy) / d
      if (cos < minCos) continue
      const score = cos - d * 0.05 // prefer straight ahead, then closer
      if (score > bestScore) {
        bestScore = score
        best = t
      }
    }
    return best
  }

  private cleanup(): void {
    this.enemies = this.enemies.filter((e) => !e.dead)
    this.orbs = this.orbs.filter((o) => !o.dead)
  }

  // ---------------------------------------------------------------- helpers

  private isOverSocket(p: Vec2): boolean {
    return distance(p, SOCKET) < TUNING.snapRadius
  }

  private clampToBounds(p: Vec2): Vec2 {
    return { x: clamp(p.x, BOUNDS.minX, BOUNDS.maxX), y: clamp(p.y, BOUNDS.minY, BOUNDS.maxY) }
  }

  // ---------------------------------------------------------------- debugging (used by ?debug and tests)

  /** Jumps straight to the intro of wave `n` (1-based) with the pedestal already awake. */
  debugSkipToWave(n: number): void {
    const heart = this.heart
    if (heart) {
      heart.state = 'socketed'
      heart.x = SOCKET.x
      heart.y = SOCKET.y
    }
    this.heldId = null
    this.enemies = []
    this.orbs = []
    this.boss = null
    this.waveIndex = clamp(Math.round(n), 1, WAVES.length) - 1
    WELLS.forEach((_, i) => {
      if (!this.shards.some((s) => s.well === i)) this.wellTimers[i] = 0.01
    })
    this.startWaveIntro()
  }

  debugSetHp(hp: number): void {
    this.hp = hp
  }

  debugDamageBoss(amount: number): void {
    this.damageBoss(amount)
  }
}

function targetPosition(t: Target): Vec2 {
  return t.kind === 'enemy' ? t.enemy : t.kind === 'orb' ? t.orb : t.boss
}
