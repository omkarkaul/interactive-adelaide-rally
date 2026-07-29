import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { loadYear } from '../src/domain/load'
import { resolveStageDetail } from '../src/domain/detail'
import type { RallyYear } from '../src/domain/types'
import { maps, type FakeMap } from './map-mock'

vi.mock('maplibre-gl', async () => {
  const { FakeMapLibreMap } = await import('./map-mock')
  return { MapLibreMap: FakeMapLibreMap, NavigationControl: class {}, ScaleControl: class {} }
})

const ALL_CODES = Array.from({ length: 30 }, (_, i) => `SS${i + 1}`)

const card = (code: string) => screen.getByRole('button', { name: new RegExp(`^${code}\\b`) })

describe('every stage carries an elevation profile after enrichment', () => {
  let year: RallyYear

  beforeAll(async () => {
    year = await loadYear(2026)
  })

  it.each(ALL_CODES)('%s has a profile with sane statistics', (code) => {
    const profile = resolveStageDetail(year, code)!.profile!
    expect(profile).not.toBeNull()
    expect(profile.lengthKm).toBeGreaterThan(0.1)
    expect(profile.samples.length).toBeGreaterThan(10)
    expect(profile.climbM).toBeGreaterThanOrEqual(0)
    expect(profile.descentM).toBeGreaterThanOrEqual(0)
    // Adelaide Hills roads, not alpine passes.
    expect(profile.maxGradePct).toBeLessThan(35)
    for (const sample of profile.samples) {
      expect(sample.elevationM).toBeGreaterThan(-20)
      expect(sample.elevationM).toBeLessThan(900)
    }
  })

  // SS29 is SS24 driven backwards, which is the clearest check that orientation
  // was resolved at ingest rather than being left to the runtime.
  it('descends on SS24 where it climbs on SS29', () => {
    const mylor = resolveStageDetail(year, 'SS24')!.profile!
    const warrawong = resolveStageDetail(year, 'SS29')!.profile!
    expect(mylor.netM).toBeLessThan(-50)
    expect(warrawong.netM).toBeGreaterThan(50)
    // The two lines are digitised independently, so their ends differ by a few
    // metres of road; the elevation change still mirrors to within that.
    expect(Math.abs(mylor.netM + warrawong.netM)).toBeLessThan(15)
    expect(mylor.lengthKm).toBeCloseTo(warrawong.lengthKm, 1)
  })

  it('keeps every source vertex, so hairpins are not cut', async () => {
    const raw = JSON.parse(
      (await import('../data/2026/geometry/day-1.geojson?raw')).default,
    ) as { features: { properties: { featureId: string }; geometry: { coordinates: number[][] } }[] }
    const corkscrew = raw.features.find((f) => f.properties.featureId === 'cherryville-plus')!
    expect(corkscrew.geometry.coordinates.length).toBeGreaterThanOrEqual(870)
  })
})

describe('stage detail view', () => {
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

  it('opens on select and returns to the list', async () => {
    await userEvent.click(card('SS4'))
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('SS4 Cherryville Plus 1')

    await userEvent.click(screen.getByRole('button', { name: /All day 1 stages/ }))
    expect(card('SS4')).toBeInTheDocument()
  })

  // The closure window sits in the sticky header rather than in a section of its
  // own, so it stays on screen while a phone scrolls the rest of the card.
  it('renders the sections in the documented order', async () => {
    await userEvent.click(card('SS4'))
    expect(screen.getByText('09:10–17:10').closest('header')).toBeInTheDocument()

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual([
      'Elevation',
      'Roads closed',
      'Start and finish',
      'Affected intersections',
      'Repeat run',
    ])
  })

  it('omits nullable sections rather than leaving a gap', async () => {
    await userEvent.click(card('SS1'))
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).not.toContain('Affected intersections')
    expect(headings).not.toContain('Repeat run')
    expect(headings).not.toContain('Spectating')
    expect(headings).toContain('Elevation')
  })

  it('shows spectator information only where the organisers named one', async () => {
    await userEvent.click(screen.getByRole('tab', { name: /Day 3/ }))
    await userEvent.click(card('SS25'))
    expect(screen.getByRole('heading', { name: 'Spectating' })).toBeInTheDocument()
  })

  it('names both runs of a repeat stage in the header', async () => {
    await userEvent.click(card('SS7'))
    expect(screen.getByText(/runs as SS4 and SS7/)).toBeInTheDocument()
  })

  it('carries the closure window, roads and provenance', async () => {
    await userEvent.click(card('SS4'))
    expect(screen.getByText('09:10–17:10')).toBeInTheDocument()
    expect(screen.getByText('Marble Hill Rd')).toBeInTheDocument()
    expect(screen.getByText('Tembys Rd/Marble Hill Rd')).toBeInTheDocument()
    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Organisers' Google map/ })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/d/viewer?mid='),
    )
  })

  it('marks an unconfirmed window as provisional in the detail view', async () => {
    await userEvent.click(screen.getByRole('tab', { name: /Day 2/ }))
    await userEvent.click(card('SS20'))
    expect(screen.getByText('Provisional')).toBeInTheDocument()
    expect(screen.getByText(/yet to be confirmed/)).toBeInTheDocument()
  })

  it('feeds the selected line to a gradient source the map can colour', async () => {
    await userEvent.click(card('SS4'))
    expect(map.sources.has('detail-line')).toBe(true)
    expect(map.layers).toContain('detail-line-grade')
    expect(map.layoutProperties.get('detail-line-grade.visibility')).toBe('visible')
    expect(map.layoutProperties.get('detail-line-arrows.visibility')).toBe('visible')
  })

  it('hides the detail layers again on the way back to the list', async () => {
    await userEvent.click(card('SS4'))
    await userEvent.click(screen.getByRole('button', { name: /All day 1 stages/ }))
    expect(map.layoutProperties.get('detail-line-grade.visibility')).toBe('none')
    expect(map.layoutProperties.get('detail-cursor-dot.visibility')).toBe('none')
  })

  it('reports the cursor position from the profile', async () => {
    await userEvent.click(card('SS4'))
    const svg = screen.getByRole('slider', { name: /Elevation profile for SS4/ })
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 400,
      top: 0,
      height: 132,
    } as DOMRect)

    await userEvent.pointer({ target: svg, coords: { clientX: 200, clientY: 60 } })
    expect(screen.getByText(/km · \d+ m · [+-]\d/)).toBeInTheDocument()
  })
})
