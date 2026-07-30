import { describe, expect, it } from 'vitest'
import { closureStateAt, combineStates } from './closureState'
import { parseClock } from '../domain/time'
import type { Closure } from '../domain/types'

const closure = (closesAt: string, reopensAt: string): Closure => ({
  id: 'c',
  stageCodes: ['SS1'],
  closesAt,
  reopensAt,
  roadsClosed: [],
  confirmed: true,
  start: 'Start Rd',
  finish: 'Finish Rd',
  intersections: [],
  notes: [],
})

const ss1 = closure('07:45', '12:45')
const at = (clock: string) => closureStateAt(ss1, parseClock(clock))

describe('closureStateAt', () => {
  it('reads pending before the road shuts', () => {
    expect(at('06:00')).toBe('pending')
    expect(at('07:44')).toBe('pending')
  })

  it('reads closed from the closing minute', () => {
    expect(at('07:45')).toBe('closed')
    expect(at('09:40')).toBe('closed')
  })

  // Matches isClosedAt: a road advertised as reopening at 12:45 is open at 12:45.
  it('reads reopened from the reopening minute, not the one after', () => {
    expect(at('12:44')).toBe('closed')
    expect(at('12:45')).toBe('reopened')
    expect(at('18:00')).toBe('reopened')
  })

  it('treats an unset time as pending, so nothing looks closed before the user scrubs', () => {
    expect(closureStateAt(ss1, null)).toBe('pending')
  })
})

describe('combineStates', () => {
  it('reads closed if any run has the road closed', () => {
    expect(combineStates(['reopened', 'closed'])).toBe('closed')
    expect(combineStates(['pending', 'closed'])).toBe('closed')
  })

  it('reads reopened only once every run is done', () => {
    expect(combineStates(['reopened', 'reopened'])).toBe('reopened')
    expect(combineStates(['reopened', 'pending'])).toBe('pending')
  })

  it('falls back to pending when nothing owns the line', () => {
    expect(combineStates([])).toBe('pending')
  })
})
