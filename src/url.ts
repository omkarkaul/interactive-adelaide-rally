import { formatClock, parseClock } from './domain/time'
import type { StageCode } from './domain/types'

export interface UrlState {
  year: number | null
  day: number | null
  stage: StageCode | null
  minutes: number | null
}

export const EMPTY_URL_STATE: UrlState = { year: null, day: null, stage: null, minutes: null }

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search)

  const int = (key: string) => {
    const raw = params.get(key)
    if (raw === null || !/^\d+$/.test(raw)) return null
    return Number(raw)
  }

  const stage = params.get('stage')
  const time = params.get('t')

  let minutes: number | null = null
  if (time) {
    try {
      minutes = parseClock(time)
    } catch {
      minutes = null
    }
  }

  return {
    year: int('year'),
    day: int('day'),
    stage: stage && /^SS\d+$/i.test(stage) ? stage.toUpperCase() : null,
    minutes,
  }
}

export function toSearch(state: UrlState): string {
  const params = new URLSearchParams()
  if (state.year !== null) params.set('year', String(state.year))
  if (state.day !== null) params.set('day', String(state.day))
  if (state.stage !== null) params.set('stage', state.stage)
  if (state.minutes !== null) params.set('t', formatClock(state.minutes))
  const search = params.toString()
  return search ? `?${search}` : ''
}
