import { describe, expect, it } from 'vitest'
import { EMPTY_URL_STATE, parseUrlState, toSearch } from './url'
import { parseClock } from './domain/time'

describe('parseUrlState', () => {
  it('reads a full deep link', () => {
    expect(parseUrlState('?year=2026&day=1&stage=SS4&t=14:30')).toEqual({
      year: 2026,
      day: 1,
      stage: 'SS4',
      minutes: parseClock('14:30'),
    })
  })

  it('is empty for an empty search', () => {
    expect(parseUrlState('')).toEqual(EMPTY_URL_STATE)
    expect(parseUrlState('?')).toEqual(EMPTY_URL_STATE)
  })

  it('ignores values it cannot trust rather than throwing', () => {
    expect(parseUrlState('?year=nope&day=-1&stage=drop%20table&t=25:99')).toEqual(EMPTY_URL_STATE)
  })

  it('normalises a lowercase stage code', () => {
    expect(parseUrlState('?stage=ss12').stage).toBe('SS12')
  })
})

describe('toSearch', () => {
  it('round-trips through parseUrlState', () => {
    const state = { year: 2026, day: 3, stage: 'SS25', minutes: parseClock('09:05') }
    expect(parseUrlState(toSearch(state))).toEqual(state)
  })

  it('omits absent keys and produces nothing when everything is absent', () => {
    expect(toSearch({ year: 2026, day: null, stage: null, minutes: null })).toBe('?year=2026')
    expect(toSearch(EMPTY_URL_STATE)).toBe('')
  })
})
