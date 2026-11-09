import { describe, expect, it } from 'vitest'
import { hintFor, type HintContext } from './hints'

const base: HintContext = {
  mode: 'webcam',
  phase: 'intro',
  wave: 1,
  bossWave: false,
  held: null,
  hovering: false,
  nearSocket: false,
  handDetected: true,
  camera: 'ready',
}

describe('hintFor', () => {
  it('asks for a hand when none is visible', () => {
    expect(hintFor({ ...base, handDetected: false })).toMatch(/raise one hand/i)
  })
  it('stays quiet while the camera is starting (a separate notice covers it)', () => {
    expect(hintFor({ ...base, camera: 'requesting' })).toBe('')
  })
  it('walks through the awakening with webcam wording', () => {
    expect(hintFor(base)).toMatch(/point/i)
    expect(hintFor({ ...base, hovering: true })).toMatch(/pinch/i)
    expect(hintFor({ ...base, held: 'heart' })).toMatch(/carry/i)
    expect(hintFor({ ...base, held: 'heart', nearSocket: true })).toMatch(/open your fingers/i)
  })
  it('uses mouse wording in mouse mode', () => {
    expect(hintFor({ ...base, mode: 'mouse' })).toMatch(/press and hold/i)
    expect(hintFor({ ...base, mode: 'mouse', phase: 'wave', held: 'shard' })).toMatch(/let go to throw/i)
  })
  it('explains shards early on and special crystals whenever held', () => {
    expect(hintFor({ ...base, phase: 'wave' })).toMatch(/shard/i)
    expect(hintFor({ ...base, phase: 'wave', held: 'shard' })).toMatch(/smash/i)
    expect(hintFor({ ...base, phase: 'wave', held: 'nova' })).toMatch(/pedestal/i)
    expect(hintFor({ ...base, phase: 'wave', held: 'ward', nearSocket: true })).toMatch(/release its power/i)
  })
  it('points at the orbs during the boss fight', () => {
    expect(hintFor({ ...base, phase: 'wave', wave: 5, bossWave: true })).toMatch(/orbs/i)
  })
  it('is empty once the run is over', () => {
    expect(hintFor({ ...base, phase: 'victory' })).toBe('')
  })
})
