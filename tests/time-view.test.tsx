import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { initialMinutes, liveMinutes } from '../src/App'
import { formatClock, parseClock } from '../src/domain/time'
import { maps, type FakeMap } from './map-mock'

vi.mock('maplibre-gl', async () => {
  const { FakeMapLibreMap } = await import('./map-mock')
  return {
    MapLibreMap: FakeMapLibreMap,
    NavigationControl: class {},
    ScaleControl: class {},
    config: { WORKER_URL: '' },
  }
})

const scrubber = () => screen.getByRole('slider', { name: /time of day/i })
const readout = () => screen.getByRole('status')
const card = (code: string) => screen.getByRole('button', { name: new RegExp(`^${code}\\b`) })
const stateOf = (map: FakeMap, featureId: string, day = 1) =>
  map.featureState.get(`stages-day-${day}/${featureId}`) ?? {}

const setScrubber = (value: number) => {
  fireEvent.change(scrubber(), { target: { value: String(value) } })
}

describe('initialMinutes', () => {
  const envelope = { closesAt: parseClock('07:45'), reopensAt: parseClock('19:10') }

  it('starts on the first closure when the user is not there on the day', () => {
    expect(initialMinutes(envelope, null)).toBe(envelope.closesAt)
  })

  it('starts on the clock during the event', () => {
    expect(initialMinutes(envelope, parseClock('11:20'))).toBe(parseClock('11:20'))
  })

  it('clamps a live clock outside the day to the envelope', () => {
    expect(initialMinutes(envelope, parseClock('05:00'))).toBe(envelope.closesAt)
    expect(initialMinutes(envelope, parseClock('23:00'))).toBe(envelope.reopensAt)
  })
})

describe('liveMinutes', () => {
  it('is null unless the viewer is looking on the day itself', () => {
    expect(liveMinutes('2026-10-16', new Date('2026-10-16T09:30:00'))).toBe(parseClock('09:30'))
    expect(liveMinutes('2026-10-16', new Date('2026-07-29T09:30:00'))).toBeNull()
  })
})

describe('time view', () => {
  let map: FakeMap

  beforeEach(async () => {
    maps.length = 0
    render(<App search="" persistUrl={false} />)
    await screen.findByRole('tab', { name: /Day 1/ })
    await waitFor(() => expect(maps).toHaveLength(1))
    map = maps[0]
    await act(async () => {
      map.fireLoad()
    })
  })

  afterEach(() => {
    maps.length = 0
  })

  it('spans the day envelope in five minute steps', () => {
    const input = scrubber() as HTMLInputElement
    expect(input.min).toBe(String(parseClock('07:45')))
    expect(input.max).toBe(String(parseClock('19:10')))
    expect(input.step).toBe('5')
  })

  it('opens on the first closure of the day outside the event', () => {
    expect(readout()).toHaveTextContent('07:45')
  })

  it('draws one Gantt bar per closure group with the shared runs merged', () => {
    const gantt = screen.getByRole('img', { name: /closure windows for day 1/i })
    expect(gantt.querySelectorAll('.gantt__bar')).toHaveLength(9)
    expect(gantt).toHaveTextContent('SS4 / SS7')
  })

  it('restyles map, panel and Gantt together as the scrubber moves', async () => {
    setScrubber(parseClock('10:00'))
    expect(readout()).toHaveTextContent('10:00')
    expect(card('SS4')).toHaveClass('is-closed')
    expect(stateOf(map, 'cherryville-plus')).toMatchObject({ closureState: 'closed' })

    setScrubber(parseClock('18:00'))
    expect(card('SS4')).not.toHaveClass('is-closed')
    expect(card('SS4')).toHaveClass('is-reopened')
    expect(stateOf(map, 'cherryville-plus')).toMatchObject({ closureState: 'reopened' })
    expect(card('SS11')).toHaveClass('is-closed')
    expect(stateOf(map, 'summit-road')).toMatchObject({ closureState: 'closed' })
  })

  it('reopens exactly on the advertised minute', async () => {
    setScrubber(parseClock('12:40'))
    expect(card('SS1')).toHaveClass('is-closed')
    setScrubber(parseClock('12:45'))
    expect(card('SS1')).not.toHaveClass('is-closed')
  })

  // Provisional windows end in dashed caps rather than on a hard edge that would
  // read as a committed time.
  it('renders unconfirmed windows differently from confirmed ones', async () => {
    const rows = (day: number) =>
      screen.getByRole('img', { name: new RegExp(`day ${day}`, 'i') }).querySelectorAll('.gantt__row')

    expect([...rows(1)].some((r) => r.classList.contains('is-provisional'))).toBe(false)
    expect(screen.queryAllByText('Provisional')).toHaveLength(0)

    await userEvent.click(screen.getByRole('tab', { name: /Day 2/ }))
    expect([...rows(2)].every((r) => r.classList.contains('is-provisional'))).toBe(true)
    expect(screen.queryAllByText('Provisional')).toHaveLength(11)
  })

  it('focuses the stage whose Gantt row is hovered', async () => {
    const row = screen
      .getByRole('img', { name: /day 1/i })
      .querySelector('.gantt__row')!
    await userEvent.hover(row)
    expect(card('SS1')).toHaveClass('is-focused')
    expect(card('SS2')).toHaveClass('is-dimmed')
  })

  it('rebases the scrubber onto each day envelope', async () => {
    await userEvent.click(screen.getByRole('tab', { name: /Day 3/ }))
    const input = scrubber() as HTMLInputElement
    expect(input.min).toBe(String(parseClock('08:00')))
    expect(input.max).toBe(String(parseClock('18:00')))
    expect(readout()).toHaveTextContent('08:00')
  })

  it('reads the scrubbed time back as a clock time', async () => {
    setScrubber(parseClock('14:30'))
    expect(formatClock(Number((scrubber() as HTMLInputElement).value))).toBe('14:30')
  })
})
