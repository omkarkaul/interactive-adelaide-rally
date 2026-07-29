import { describe, expect, it } from 'vitest'
import {
  clampToWindow,
  durationMinutes,
  envelopeOf,
  formatClock,
  formatWindow,
  isClosedAt,
  parseClock,
  parseWindow,
} from './time'
import type { Closure } from './types'

const closure = (closesAt: string, reopensAt: string): Closure => ({
  id: 'test',
  stageCodes: ['SS4'],
  roadsClosed: [],
  start: '',
  finish: '',
  intersections: [],
  closesAt,
  reopensAt,
  confirmed: true,
  notes: [],
})

describe('parseClock', () => {
  it('reads HH:MM into minutes since midnight', () => {
    expect(parseClock('00:00')).toBe(0)
    expect(parseClock('09:10')).toBe(550)
    expect(parseClock('23:59')).toBe(1439)
  })

  it('rejects anything that is not a clock time', () => {
    expect(() => parseClock('9.10')).toThrow()
    expect(() => parseClock('24:00')).toThrow()
    expect(() => parseClock('09:60')).toThrow()
  })
})

describe('formatClock', () => {
  it('pads back to HH:MM', () => {
    expect(formatClock(550)).toBe('09:10')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(1439)).toBe('23:59')
  })
})

describe('parseWindow', () => {
  it('reads both ends', () => {
    expect(parseWindow('09:10', '17:10')).toEqual({ closesAt: 550, reopensAt: 1030 })
  })
})

describe('isClosedAt', () => {
  const c = closure('09:10', '17:10')

  it('is closed at exactly closesAt', () => {
    expect(isClosedAt(c, parseClock('09:10'))).toBe(true)
  })

  it('is open at exactly reopensAt', () => {
    expect(isClosedAt(c, parseClock('17:10'))).toBe(false)
  })

  it('is open one minute before closing and closed one minute before reopening', () => {
    expect(isClosedAt(c, parseClock('09:09'))).toBe(false)
    expect(isClosedAt(c, parseClock('17:09'))).toBe(true)
  })
})

describe('formatWindow and durationMinutes', () => {
  it('reads the window back as the organisers wrote it', () => {
    expect(formatWindow(closure('09:10', '17:10'))).toBe('09:10–17:10')
    expect(durationMinutes(closure('09:10', '17:10'))).toBe(480)
  })
})

describe('envelopeOf', () => {
  it('spans the earliest close to the latest reopen', () => {
    expect(envelopeOf([closure('09:10', '17:10'), closure('07:45', '12:45')])).toEqual({
      closesAt: parseClock('07:45'),
      reopensAt: parseClock('17:10'),
    })
  })

  it('is null with no closures', () => {
    expect(envelopeOf([])).toBeNull()
  })
})

describe('clampToWindow', () => {
  it('holds the scrubber inside the envelope', () => {
    const window = { closesAt: 100, reopensAt: 200 }
    expect(clampToWindow(50, window)).toBe(100)
    expect(clampToWindow(150, window)).toBe(150)
    expect(clampToWindow(500, window)).toBe(200)
  })
})
