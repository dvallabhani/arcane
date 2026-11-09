import { describe, expect, it } from 'vitest'
import { CrystalInteraction, DEFAULT_CONFIG } from './interaction'

const DT = 1 / 60
const start = DEFAULT_CONFIG.start
const socket = DEFAULT_CONFIG.socket

/** Runs `frames` updates with the same input and collects every event. */
function run(c: CrystalInteraction, pointer: { x: number; y: number } | null, grip: boolean, frames = 1) {
  const events: string[] = []
  for (let i = 0; i < frames; i++) events.push(...c.update({ pointer, grip }, DT))
  return events
}

/** Grab the crystal at its current position, carry it to `to`, keep holding. */
function grabAndCarry(c: CrystalInteraction, to: { x: number; y: number }) {
  run(c, c.position, false) // hover
  run(c, c.position, true) // press
  run(c, to, true, 120) // carry for two seconds
}

describe('CrystalInteraction', () => {
  it('starts idle at the start position', () => {
    const c = new CrystalInteraction()
    expect(c.state).toBe('idle')
    expect(c.position).toEqual(start)
  })

  it('stays idle when the cursor is far away', () => {
    const c = new CrystalInteraction()
    run(c, { x: start.x + 3, y: start.y }, false)
    expect(c.state).toBe('idle')
  })

  it('becomes hovered when the cursor is close', () => {
    const c = new CrystalInteraction()
    run(c, { x: start.x + 0.3, y: start.y }, false)
    expect(c.state).toBe('hovered')
  })

  it('uses hysteresis so hover does not flicker at the edge', () => {
    const c = new CrystalInteraction()
    const edge = (DEFAULT_CONFIG.hoverEnter + DEFAULT_CONFIG.hoverExit) / 2
    run(c, { x: start.x + edge, y: start.y }, false)
    expect(c.state).toBe('idle') // between the two radii: not close enough to enter...
    run(c, { x: start.x + 0.2, y: start.y }, false)
    run(c, { x: start.x + edge, y: start.y }, false)
    expect(c.state).toBe('hovered') // ...but not far enough to leave
  })

  it('grabs only when the grip starts while hovering', () => {
    const c = new CrystalInteraction()
    expect(run(c, start, true)).toEqual(['grabbed'])
    expect(c.state).toBe('grabbed')
  })

  it('does not grab when the grip started elsewhere and swept onto the crystal', () => {
    const c = new CrystalInteraction()
    run(c, { x: start.x + 3, y: start.y }, true) // pinch far away
    run(c, start, true) // move onto crystal while still pinching
    expect(c.state).toBe('hovered')
  })

  it('follows the cursor while grabbed', () => {
    const c = new CrystalInteraction()
    grabAndCarry(c, { x: 0, y: 2.5 })
    expect(c.state).toBe('grabbed')
    expect(c.position.x).toBeCloseTo(0, 2)
    expect(c.position.y).toBeCloseTo(2.5, 2)
  })

  it('keeps the crystal inside the play area', () => {
    const c = new CrystalInteraction()
    grabAndCarry(c, { x: -50, y: -50 })
    expect(c.position.x).toBeCloseTo(DEFAULT_CONFIG.bounds.minX, 2)
    expect(c.position.y).toBeCloseTo(DEFAULT_CONFIG.bounds.minY, 2)
  })

  it('stays where it was released when not over the pedestal', () => {
    const c = new CrystalInteraction()
    grabAndCarry(c, { x: 0, y: 2.5 })
    expect(run(c, { x: 0, y: 2.5 }, false)).toEqual(['released'])
    const dropped = { ...c.position }
    run(c, { x: 3, y: 3 }, false, 60)
    expect(c.position).toEqual(dropped)
    expect(c.state).toBe('idle')
  })

  it('reports nearSocket while carried over the pedestal', () => {
    const c = new CrystalInteraction()
    grabAndCarry(c, socket)
    expect(c.nearSocket).toBe(true)
  })

  it('is placed and snaps to the socket when released near the pedestal', () => {
    const c = new CrystalInteraction()
    const nearby = { x: socket.x + 0.5, y: socket.y + 0.3 }
    grabAndCarry(c, nearby)
    expect(run(c, nearby, false)).toEqual(['placed'])
    expect(c.state).toBe('placed')
    run(c, null, false, 120)
    expect(c.position.x).toBeCloseTo(socket.x, 3)
    expect(c.position.y).toBeCloseTo(socket.y, 3)
  })

  it('ignores input once placed', () => {
    const c = new CrystalInteraction()
    grabAndCarry(c, socket)
    run(c, socket, false)
    expect(run(c, socket, true)).toEqual([])
    expect(c.state).toBe('placed')
  })

  it('releases the crystal when the cursor disappears (hand lost)', () => {
    const c = new CrystalInteraction()
    grabAndCarry(c, { x: 0, y: 2 })
    expect(run(c, null, true)).toEqual(['released'])
    expect(c.state).toBe('idle')
  })

  it('counts a hand lost over the pedestal as a placement', () => {
    const c = new CrystalInteraction()
    grabAndCarry(c, socket)
    expect(run(c, null, true)).toEqual(['placed'])
    expect(c.state).toBe('placed')
  })

  it('reset returns everything to the start', () => {
    const c = new CrystalInteraction()
    grabAndCarry(c, socket)
    run(c, socket, false)
    c.reset()
    expect(c.state).toBe('idle')
    expect(c.position).toEqual(start)
    expect(c.nearSocket).toBe(false)
  })

  it('after reset, a grip that is still held cannot instantly re-grab', () => {
    const c = new CrystalInteraction()
    c.reset()
    run(c, start, true)
    expect(c.state).toBe('hovered')
    run(c, start, false)
    run(c, start, true)
    expect(c.state).toBe('grabbed')
  })

  it('places the crystal when released with the cursor over the pedestal, even if it is still catching up', () => {
    const c = new CrystalInteraction()
    run(c, start, false)
    run(c, start, true)
    run(c, socket, true) // one frame: the crystal has only moved part of the way
    expect(c.position.x).toBeLessThan(socket.x - DEFAULT_CONFIG.snapRadius)
    expect(run(c, socket, false)).toEqual(['placed'])
  })

  it('handles a press and release that both happen between two frames (dt = 0 replays)', () => {
    const c = new CrystalInteraction()
    expect(c.update({ pointer: start, grip: true }, 0)).toEqual(['grabbed'])
    expect(c.update({ pointer: socket, grip: false }, 0)).toEqual(['placed'])
  })

  it('a quick click on the crystal away from the pedestal just picks it up and puts it down', () => {
    const c = new CrystalInteraction()
    c.update({ pointer: start, grip: true }, 0)
    expect(c.update({ pointer: start, grip: false }, 0)).toEqual(['released'])
    expect(c.position).toEqual(start)
  })

  it('behaves the same at different frame rates', () => {
    const a = new CrystalInteraction()
    const b = new CrystalInteraction()
    for (const c of [a, b]) {
      run(c, start, false)
      run(c, start, true)
    }
    for (let i = 0; i < 30; i++) a.update({ pointer: { x: 0, y: 2 }, grip: true }, 1 / 30)
    for (let i = 0; i < 144; i++) b.update({ pointer: { x: 0, y: 2 }, grip: true }, 1 / 144)
    expect(a.position.x).toBeCloseTo(b.position.x, 3)
  })
})
