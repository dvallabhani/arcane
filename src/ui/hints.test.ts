import { describe, expect, it } from 'vitest'
import { hintFor, type HintContext } from './hints'

const base: HintContext = { mode: 'webcam', crystal: 'idle', nearSocket: false, handDetected: true, camera: 'ready' }

describe('hintFor', () => {
  it('asks for a hand when none is visible', () => {
    expect(hintFor({ ...base, handDetected: false })).toMatch(/raise one hand/i)
  })
  it('walks through the webcam steps', () => {
    expect(hintFor(base)).toMatch(/point/i)
    expect(hintFor({ ...base, crystal: 'hovered' })).toMatch(/pinch/i)
    expect(hintFor({ ...base, crystal: 'grabbed' })).toMatch(/move to the pedestal/i)
    expect(hintFor({ ...base, crystal: 'grabbed', nearSocket: true })).toMatch(/open your fingers/i)
  })
  it('stays quiet while the camera is starting (a separate notice covers it)', () => {
    expect(hintFor({ ...base, camera: 'requesting' })).toBe('')
  })
  it('uses mouse wording in mouse mode', () => {
    expect(hintFor({ ...base, mode: 'mouse' })).toMatch(/press and hold/i)
    expect(hintFor({ ...base, mode: 'mouse', crystal: 'grabbed', nearSocket: true })).toMatch(/let go/i)
  })
  it('celebrates once placed', () => {
    expect(hintFor({ ...base, crystal: 'placed' })).toMatch(/awake/i)
  })
})
