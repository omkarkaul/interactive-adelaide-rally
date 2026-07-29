import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { maps, type FakeMap } from './map-mock'

vi.mock('maplibre-gl', async () => {
  const { FakeMapLibreMap } = await import('./map-mock')
  return { MapLibreMap: FakeMapLibreMap, NavigationControl: class {}, ScaleControl: class {} }
})

const stateOf = (map: FakeMap, featureId: string, day = 1) =>
  map.featureState.get(`stages-day-${day}/${featureId}`) ?? {}

const visible = (map: FakeMap, layerId: string) =>
  map.layoutProperties.get(`${layerId}.visibility`)

const card = (code: string) => screen.getByRole('button', { name: new RegExp(`^${code}\\b`) })

describe('day view', () => {
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

  it('renders the three days from committed data', () => {
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /^SS/ })).toHaveLength(11)
  })

  it('gives each day its own source, casing, line, hit and termini layers', () => {
    for (const day of [1, 2, 3]) {
      expect(map.sources.has(`stages-day-${day}`)).toBe(true)
      expect(map.sources.has(`termini-day-${day}`)).toBe(true)
      expect(map.layers).toContain(`stages-casing-day-${day}`)
      expect(map.layers).toContain(`stages-line-day-${day}`)
      expect(map.layers).toContain(`stages-hit-day-${day}`)
    }
  })

  it('shows only the selected day and switches on the tab', async () => {
    expect(visible(map, 'stages-line-day-1')).toBe('visible')
    expect(visible(map, 'stages-line-day-2')).toBe('none')

    await userEvent.click(screen.getByRole('tab', { name: /Day 2/ }))
    expect(visible(map, 'stages-line-day-1')).toBe('none')
    expect(visible(map, 'stages-line-day-2')).toBe('visible')
    expect(screen.getAllByRole('button', { name: /^SS/ })).toHaveLength(11)
  })

  it('dims nothing until something is focused', () => {
    expect(stateOf(map, 'beaumont')).toMatchObject({ focused: false, dimmed: false })
    expect(stateOf(map, 'cherryville-plus')).toMatchObject({ focused: false, dimmed: false })
  })

  it('focuses and dims from the panel', async () => {
    await userEvent.hover(card('SS4'))
    expect(stateOf(map, 'cherryville-plus')).toMatchObject({ focused: true, dimmed: false })
    expect(stateOf(map, 'beaumont')).toMatchObject({ focused: false, dimmed: true })
  })

  it('focuses and dims from the map', async () => {
    await act(async () => {
      map.fire('mousemove', 'stages-hit-day-1', { features: [{ id: 'cherryville-plus' }] })
    })
    expect(card('SS4')).toHaveClass('is-focused')
    expect(card('SS1')).toHaveClass('is-dimmed')
  })

  // Both runs share one line, so focusing either must light the same feature.
  it('lights the shared feature from either of its runs', async () => {
    await userEvent.hover(card('SS7'))
    expect(stateOf(map, 'cherryville-plus')).toMatchObject({ focused: true })
  })

  it('fits the day on load and the stage on select, padding for the panel', async () => {
    map.fitBounds.mockClear()
    await userEvent.click(card('SS4'))

    const [bounds, options] = map.fitBounds.mock.calls.at(-1)!
    expect(bounds).toHaveLength(4)
    expect(options.padding.left).toBeGreaterThan(options.padding.right)

    map.fitBounds.mockClear()
    await userEvent.click(screen.getByRole('button', { name: /All day 1 stages/ }))
    const [dayBounds, dayOptions] = map.fitBounds.mock.calls.at(-1)!
    expect(dayOptions.padding.left).toBe(dayOptions.padding.right)
    expect(dayBounds[2] - dayBounds[0]).toBeGreaterThan(bounds[2] - bounds[0])
  })

  it('clears the selection on a click outside any stage', async () => {
    await userEvent.click(card('SS4'))
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('SS4')

    await act(async () =>
      map.fire('click', null, {
        defaultPrevented: false,
        point: { x: 10, y: 10 },
        lngLat: { lng: 130, lat: -20 },
      }),
    )
    expect(card('SS4')).toHaveClass('is-normal')
  })

  it('keeps a selection sticky while the pointer moves over another line', async () => {
    await userEvent.click(card('SS4'))
    await act(async () => {
      map.fire('mousemove', 'stages-hit-day-1', { features: [{ id: 'beaumont' }] })
    })
    expect(stateOf(map, 'cherryville-plus')).toMatchObject({ focused: true })
    expect(stateOf(map, 'beaumont')).toMatchObject({ focused: false, dimmed: true })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('SS4')
  })

  it('carries the safety notice and a source link on every view', () => {
    expect(screen.getByRole('note')).toHaveTextContent(/closed public roads/i)
    expect(screen.getByRole('link', { name: /adelaiderally\.com\.au\/route/ })).toHaveAttribute(
      'href',
      'https://www.adelaiderally.com.au/route',
    )
  })
})
