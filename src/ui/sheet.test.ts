import { describe, expect, it } from 'vitest'
import { clampFraction, MAX_SNAP, MIN_SNAP, nearestSnap, SNAP_POINTS, stepSnap } from './sheet'

describe('sheet snapping', () => {
  it('offers the three documented positions', () => {
    expect([...SNAP_POINTS]).toEqual([0.25, 0.55, 0.9])
  })

  it('snaps to whichever position the drag ended closest to', () => {
    expect(nearestSnap(0.26)).toBe(0.25)
    expect(nearestSnap(0.44)).toBe(0.55)
    expect(nearestSnap(0.71)).toBe(0.55)
    expect(nearestSnap(0.8)).toBe(0.9)
  })

  it('never leaves the sheet outside its travel', () => {
    expect(clampFraction(0)).toBe(MIN_SNAP)
    expect(clampFraction(1.4)).toBe(MAX_SNAP)
    expect(clampFraction(0.5)).toBe(0.5)
  })

  // A drag is not reachable from a keyboard, so the same three stops have to be
  // available by stepping through them.
  it('steps between neighbouring positions and stops at the ends', () => {
    expect(stepSnap(0.25, 1)).toBe(0.55)
    expect(stepSnap(0.55, 1)).toBe(0.9)
    expect(stepSnap(0.9, 1)).toBe(0.9)
    expect(stepSnap(0.55, -1)).toBe(0.25)
    expect(stepSnap(0.25, -1)).toBe(0.25)
  })

  it('steps from a resting point that is mid-drag', () => {
    expect(stepSnap(0.5, 1)).toBe(0.9)
    expect(stepSnap(0.5, -1)).toBe(0.25)
  })
})
