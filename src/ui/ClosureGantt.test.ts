import { describe, expect, it } from 'vitest'
import { GUTTER_PX, hourTicks, timeScale } from './ClosureGantt'
import { THUMB_PX } from './TimeScrubber'
import { parseClock } from '../domain/time'

const FROM = parseClock('07:45')
const TO = parseClock('19:10')

describe('timeScale', () => {
  const width = 1408
  const x = timeScale(width, FROM, TO)

  // A range input's thumb centre starts half a thumb in and ends half a thumb
  // short of the far edge. The Gantt has to land on those same two pixels, or
  // the now-line drifts away from the control that moves it.
  it('starts and ends where the scrubber thumb does', () => {
    expect(x(FROM)).toBe(THUMB_PX / 2)
    expect(x(TO)).toBe(width - THUMB_PX / 2)
  })

  it('places the midpoint at the middle of the track', () => {
    expect(x((FROM + TO) / 2)).toBeCloseTo(width / 2, 6)
  })

  it('is linear, so equal times are equal distances apart', () => {
    const hour = 60
    const first = x(FROM + hour) - x(FROM)
    const later = x(FROM + 5 * hour) - x(FROM + 4 * hour)
    expect(first).toBeCloseTo(later, 6)
  })

  // Everything collapses onto the origin rather than onto x=0, so an unmeasured
  // chart draws a degenerate line at the start of the track instead of hard left.
  it('collapses safely before the container has been measured', () => {
    expect(timeScale(0, FROM, TO)(FROM)).toBe(THUMB_PX / 2)
    expect(timeScale(10, FROM, FROM)(FROM)).toBe(THUMB_PX / 2)
    expect(timeScale(0, FROM, TO, GUTTER_PX)(FROM)).toBe(GUTTER_PX + THUMB_PX / 2)
  })

  // The row labels sit in a gutter, so the plot starts inboard of the chart. The
  // scrubber input is indented by the same token; if these drift the now-line no
  // longer sits under the thumb, which is the defect this scale exists to prevent.
  it('starts the plot after the label gutter, where the scrubber track starts', () => {
    const g = timeScale(width, FROM, TO, GUTTER_PX)
    expect(g(FROM)).toBe(GUTTER_PX + THUMB_PX / 2)
    expect(g(TO)).toBe(width - THUMB_PX / 2)
    expect(g((FROM + TO) / 2)).toBeCloseTo((GUTTER_PX + width) / 2, 6)
  })
})

describe('hourTicks', () => {
  it('labels every hour when there is room', () => {
    // 07:45–19:10 covers 08:00 through 19:00.
    expect(hourTicks(FROM, TO, 1400)).toHaveLength(12)
    expect(hourTicks(FROM, TO, 1400)[0]).toBe(parseClock('08:00'))
  })

  // On a phone the day does not fit at one label per hour, and the labels used
  // to overprint into an unreadable run.
  it('thins to two- and three-hourly as the track narrows', () => {
    const wide = hourTicks(FROM, TO, 1400)
    const narrow = hourTicks(FROM, TO, 380)
    const tiny = hourTicks(FROM, TO, 200)

    expect(narrow.length).toBeLessThan(wide.length)
    expect(tiny.length).toBeLessThanOrEqual(narrow.length)
    for (const ticks of [wide, narrow, tiny]) {
      const gaps = ticks.slice(1).map((t, i) => t - ticks[i])
      expect(new Set(gaps).size).toBeLessThanOrEqual(1)
    }
  })

  it('keeps every tick on the hour and inside the envelope', () => {
    for (const width of [200, 380, 700, 1400]) {
      for (const tick of hourTicks(FROM, TO, width)) {
        expect(tick % 60).toBe(0)
        expect(tick).toBeGreaterThanOrEqual(FROM)
        expect(tick).toBeLessThanOrEqual(TO)
      }
    }
  })
})
