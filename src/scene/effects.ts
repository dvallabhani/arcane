import { Color } from 'three'
import { PEDESTAL_HIT, SOCKET, TUNING } from '../game/constants'
import type { GameEvent } from '../game/world'

/*
 * Visual effects as plain data, filled in response to game events and drawn
 * by <Effects/>. One shared particle pool serves every burst (kills, impacts,
 * the awakening), recycled oldest-first.
 */

export const MAX_PARTICLES = 1200

export const particles = {
  position: new Float32Array(MAX_PARTICLES * 3),
  velocity: new Float32Array(MAX_PARTICLES * 3),
  baseColor: new Float32Array(MAX_PARTICLES * 3),
  life: new Float32Array(MAX_PARTICLES), // seconds left
  maxLife: new Float32Array(MAX_PARTICLES),
  next: 0,
}

export interface Ring {
  active: boolean
  x: number
  y: number
  age: number
  life: number
  radius: number
  color: Color
}

export const MAX_RINGS = 10
export const rings: Ring[] = Array.from({ length: MAX_RINGS }, () => ({
  active: false,
  x: 0,
  y: 0,
  age: 0,
  life: 1,
  radius: 1,
  color: new Color(),
}))
let nextRing = 0

/** Camera shake strength; decays in the camera rig. */
export const shake = { amount: 0 }

export const COLORS = {
  shadow: new Color('#ff2e63'),
  crystal: new Color('#5ef2ff'),
  gold: new Color('#ffc65c'),
  mint: new Color('#7dffc8'),
  violet: new Color('#b48cff'),
  danger: new Color('#ff5050'),
}

/** Throws `count` particles outward from (x, y). */
export function burst(x: number, y: number, color: Color, count: number, speed: number, life = 0.9, z = 0): void {
  const p = particles
  for (let n = 0; n < count; n++) {
    const i = p.next
    p.next = (p.next + 1) % MAX_PARTICLES
    // random direction on a sphere, random speed
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    const s = speed * (0.35 + Math.random() * 0.65)
    p.position.set([x, y, z], i * 3)
    p.velocity.set([Math.sin(phi) * Math.cos(theta) * s, Math.cos(phi) * s, Math.sin(phi) * Math.sin(theta) * s * 0.6], i * 3)
    const shade = 0.75 + Math.random() * 0.5
    p.baseColor.set([color.r * shade, color.g * shade, color.b * shade], i * 3)
    p.life[i] = p.maxLife[i] = life * (0.6 + Math.random() * 0.6)
  }
}

/** An expanding ring on the play plane. */
export function ring(x: number, y: number, color: Color, radius: number, life = 0.6): void {
  const r = rings[nextRing]
  nextRing = (nextRing + 1) % MAX_RINGS
  r.active = true
  r.x = x
  r.y = y
  r.age = 0
  r.life = life
  r.radius = radius
  r.color.copy(color)
}

export function addShake(amount: number): void {
  shake.amount = Math.min(1, shake.amount + amount)
}

export function clearEffects(): void {
  particles.life.fill(0)
  rings.forEach((r) => (r.active = false))
  shake.amount = 0
}

/** Maps game events to particles, rings and shake. */
export function playEffects(events: GameEvent[]): void {
  const c = COLORS
  for (const e of events) {
    switch (e.type) {
      case 'kill':
        burst(e.x, e.y, c.shadow, e.kind === 'brute' ? 40 : 24, 2.6)
        burst(e.x, e.y, c.crystal, 8, 1.8, 0.6)
        ring(e.x, e.y, c.shadow, e.kind === 'brute' ? 1.3 : 0.8, 0.35)
        break
      case 'enemy-hit':
        burst(e.x, e.y, c.shadow, 10, 2)
        break
      case 'smash':
        burst(e.x, e.y, c.crystal, 8, 2.2, 0.5)
        addShake(0.05)
        break
      case 'shard-shatter':
        burst(e.x, e.y, c.crystal, 18, 2.4, 0.7)
        break
      case 'shard-spawn':
        burst(e.x, e.y, e.kind === 'nova' ? c.gold : e.kind === 'ward' ? c.mint : c.crystal, 10, 0.9, 0.8)
        break
      case 'enemy-spawn':
        burst(e.x, e.y, c.shadow, 8, 0.8, 0.7)
        break
      case 'orb-destroyed':
        burst(e.x, e.y, c.shadow, 14, 2)
        break
      case 'pedestal-hit':
        burst(e.x, e.y, c.danger, 22, 2.4)
        ring(PEDESTAL_HIT.x, PEDESTAL_HIT.y, c.danger, 1.6, 0.45)
        addShake(0.35)
        break
      case 'shield-block':
        burst(e.x, e.y, c.mint, 16, 2.2)
        ring(e.x, e.y, c.mint, 0.9, 0.4)
        break
      case 'awaken':
        burst(SOCKET.x, SOCKET.y, c.gold, 180, 4.2, 1.6)
        ring(SOCKET.x, SOCKET.y, c.gold, 6.5, 1.2)
        addShake(0.15)
        break
      case 'ward':
        burst(SOCKET.x, SOCKET.y, c.mint, 90, 3, 1.2)
        ring(SOCKET.x, SOCKET.y, c.mint, 2.4, 0.7)
        break
      case 'nova':
        burst(SOCKET.x, SOCKET.y, c.gold, 160, 5, 1.1)
        ring(SOCKET.x, SOCKET.y, c.gold, TUNING.novaRadius, 0.55)
        ring(SOCKET.x, SOCKET.y, c.violet, TUNING.novaRadius * 0.7, 0.75)
        addShake(0.45)
        break
      case 'wave-clear':
        ring(SOCKET.x, SOCKET.y, c.crystal, 7, 1.4)
        break
      case 'boss-spawn':
        addShake(0.4)
        break
      case 'boss-hit':
        burst(e.x, e.y, c.shadow, 22, 2.8)
        addShake(0.12)
        break
      case 'boss-attack':
        burst(e.x, e.y, c.shadow, 10, 1.2, 0.6)
        break
      case 'boss-defeated':
        burst(e.x, e.y, c.shadow, 260, 5.5, 2)
        burst(e.x, e.y, c.gold, 120, 4, 1.8)
        ring(e.x, e.y, c.shadow, 8, 1.5)
        addShake(0.9)
        break
      case 'victory':
        burst(SOCKET.x, SOCKET.y, c.gold, 200, 4.5, 2)
        break
      case 'defeat':
        ring(SOCKET.x, SOCKET.y, c.danger, 8, 1.6)
        addShake(0.6)
        break
    }
  }
}
