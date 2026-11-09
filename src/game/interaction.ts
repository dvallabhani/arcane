import { BOUNDS, CRYSTAL_START, INTERACTION, SOCKET } from './constants'
import { clamp, damp, distance, type Vec2 } from './math'

/**
 * idle    – resting, subtle glow
 * hovered – cursor is close enough to grab it, glow intensifies
 * grabbed – following the cursor while the user pinches / holds the mouse button
 * placed  – dropped on the pedestal; the objective is complete
 */
export type CrystalState = 'idle' | 'hovered' | 'grabbed' | 'placed'

export type InteractionEvent = 'grabbed' | 'released' | 'placed'

export interface InteractionInput {
  /** Cursor position on the interaction plane, or null when there is no cursor (hand lost, mouse left). */
  pointer: Vec2 | null
  /** true while the user is pinching (webcam) or holding the mouse button (mouse). */
  grip: boolean
}

export interface InteractionConfig {
  start: Vec2
  socket: Vec2
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  hoverEnter: number
  hoverExit: number
  snapRadius: number
  followSpeed: number
  snapSpeed: number
}

export const DEFAULT_CONFIG: InteractionConfig = {
  start: CRYSTAL_START,
  socket: SOCKET,
  bounds: BOUNDS,
  ...INTERACTION,
}

/**
 * The single source of truth for the crystal. It knows nothing about React,
 * Three.js, mice or webcams: every frame it receives a pointer position and a
 * "grip" flag and updates the crystal. Mouse mode and webcam mode both feed
 * this same class, which is why they behave identically.
 */
export class CrystalInteraction {
  state: CrystalState = 'idle'
  position: Vec2
  /** True while a grabbed crystal is close enough to the pedestal to be placed. */
  nearSocket = false

  private readonly config: InteractionConfig
  private prevGrip = false

  constructor(config: InteractionConfig = DEFAULT_CONFIG) {
    this.config = config
    this.position = { ...config.start }
  }

  reset(): void {
    this.state = 'idle'
    this.position = { ...this.config.start }
    this.nearSocket = false
    // Pretend the grip is already held so a pinch that is still active during
    // the reset can't instantly re-grab the crystal; the user must let go first.
    this.prevGrip = true
  }

  /** Advance the simulation by `dt` seconds. Returns any events that happened this frame. */
  update(input: InteractionInput, dt: number): InteractionEvent[] {
    const events: InteractionEvent[] = []
    const { pointer, grip } = input
    const gripStarted = grip && !this.prevGrip
    this.prevGrip = grip

    // Once placed, input is ignored and the crystal glides into the socket.
    if (this.state === 'placed') {
      this.moveToward(this.config.socket, this.config.snapSpeed, dt)
      return events
    }

    // No cursor at all (hand left the camera, mouse left the window).
    if (pointer === null) {
      const placed = this.state === 'grabbed' && this.release(events)
      // A crystal released over the pedestal still counts as placed.
      if (!placed) this.state = 'idle'
      return events
    }

    if (this.state === 'grabbed') {
      const target = this.clampToBounds(pointer)
      if (!grip) {
        this.release(events, target)
        return events
      }
      this.moveToward(target, this.config.followSpeed, dt)
      this.nearSocket = this.isOverSocket(this.position) || this.isOverSocket(target)
      return events
    }

    // idle or hovered: is the cursor over the crystal?
    const d = distance(pointer, this.position)
    const radius = this.state === 'hovered' ? this.config.hoverExit : this.config.hoverEnter
    this.state = d < radius ? 'hovered' : 'idle'

    // A grab only starts on the *moment* the grip begins while hovering.
    // Pinching first and then sweeping across the crystal does not grab it.
    if (this.state === 'hovered' && gripStarted) {
      this.state = 'grabbed'
      events.push('grabbed')
    }
    return events
  }

  /**
   * Lets go of the crystal. Returns true if it landed on the pedestal.
   *
   * The crystal eases toward the cursor, so after a quick flick it can still be
   * trailing behind. What the player meant is "drop it where my cursor is", so
   * releasing with the cursor over the pedestal counts too.
   */
  private release(events: InteractionEvent[], cursor: Vec2 | null = null): boolean {
    this.nearSocket = false
    if (this.isOverSocket(this.position) || (cursor !== null && this.isOverSocket(cursor))) {
      this.state = 'placed'
      events.push('placed')
      return true
    }
    // The crystal stays where it was dropped. It counts as hovered because
    // the cursor is still on top of it.
    this.state = 'hovered'
    events.push('released')
    return false
  }

  private isOverSocket(point: Vec2): boolean {
    return distance(point, this.config.socket) < this.config.snapRadius
  }

  private clampToBounds(point: Vec2): Vec2 {
    const b = this.config.bounds
    return { x: clamp(point.x, b.minX, b.maxX), y: clamp(point.y, b.minY, b.maxY) }
  }

  private moveToward(target: Vec2, speed: number, dt: number): void {
    this.position = {
      x: damp(this.position.x, target.x, speed, dt),
      y: damp(this.position.y, target.y, speed, dt),
    }
  }
}
