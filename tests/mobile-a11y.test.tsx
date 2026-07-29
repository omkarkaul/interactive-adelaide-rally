import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { parseUrlState } from '../src/url'
import { maps } from './map-mock'

vi.mock('maplibre-gl', async () => {
  const { FakeMapLibreMap } = await import('./map-mock')
  return {
    MapLibreMap: FakeMapLibreMap,
    NavigationControl: class {},
    ScaleControl: class {},
    config: { WORKER_URL: '' },
  }
})

const card = (code: string) => screen.getByRole('button', { name: new RegExp(`^${code}\\b`) })
const profile = () => screen.getByRole('slider', { name: /Elevation profile/ })

async function mount(search = '', persistUrl = false) {
  maps.length = 0
  render(<App search={search} persistUrl={persistUrl} />)
  await screen.findByRole('tab', { name: /Day 1/ })
  await waitFor(() => expect(maps).toHaveLength(1))
  const map = maps[0]
  await act(async () => {
    map.fireLoad()
  })
  return map
}

afterEach(() => {
  maps.length = 0
})

describe('keyboard', () => {
  beforeEach(async () => {
    await mount()
  })

  it('reaches the day tabs, the stage list and the scrubber by tabbing', async () => {
    await userEvent.tab()
    expect(screen.getByRole('tab', { name: /Day 1/ })).toHaveFocus()

    const reachable = new Set<string>()
    for (let i = 0; i < 20; i++) {
      await userEvent.tab()
      const active = document.activeElement as HTMLElement
      if (active?.getAttribute('role')) reachable.add(active.getAttribute('role')!)
      if (active?.tagName) reachable.add(active.tagName.toLowerCase())
    }
    expect(reachable.has('button')).toBe(true)
    expect(reachable.has('tab')).toBe(true)
  })

  it('focuses a stage card and opens it with the keyboard alone', async () => {
    card('SS1').focus()
    expect(card('SS1')).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('SS1')
  })

  it('makes the profile focusable and steps the cursor with the arrow keys', async () => {
    await userEvent.click(card('SS4'))
    profile().focus()
    expect(profile()).toHaveFocus()
    expect(profile()).toHaveAttribute('aria-valuenow', '0')

    await userEvent.keyboard('{ArrowRight}')
    const after = Number(profile().getAttribute('aria-valuenow'))
    expect(after).toBeGreaterThan(0)

    await userEvent.keyboard('{ArrowLeft}')
    expect(Number(profile().getAttribute('aria-valuenow'))).toBeLessThan(after)
  })

  it('takes a shift-arrow in coarser steps and jumps to the ends', async () => {
    await userEvent.click(card('SS4'))
    profile().focus()

    await userEvent.keyboard('{ArrowRight}')
    const fine = Number(profile().getAttribute('aria-valuenow'))
    await userEvent.keyboard('{Home}{Shift>}{ArrowRight}{/Shift}')
    expect(Number(profile().getAttribute('aria-valuenow'))).toBeGreaterThan(fine * 5)

    await userEvent.keyboard('{End}')
    const max = Number(profile().getAttribute('aria-valuemax'))
    expect(Number(profile().getAttribute('aria-valuenow'))).toBe(max)
  })

  it('announces distance, elevation and grade through a live region', async () => {
    await userEvent.click(card('SS4'))
    profile().focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')

    const live = document.querySelector('[aria-live="polite"]')!
    expect(live.textContent).toMatch(/\d+\.\d+ km · \d+ m · [+-]\d+\.\d%/)
    expect(profile().getAttribute('aria-valuetext')).toBe(live.textContent)
  })
})

describe('long lists collapse', () => {
  beforeEach(async () => {
    await mount()
  })

  it('collapses beyond eight entries and expands on request', async () => {
    await userEvent.click(screen.getByRole('tab', { name: /Day 2/ }))
    await userEvent.click(card('SS16'))

    const section = screen.getByRole('heading', { name: 'Affected intersections' }).parentElement!
    expect(within(section).getAllByRole('listitem')).toHaveLength(8)

    await userEvent.click(within(section).getByRole('button', { name: /Show all 11/ }))
    expect(within(section).getAllByRole('listitem')).toHaveLength(11)

    await userEvent.click(within(section).getByRole('button', { name: /Show fewer/ }))
    expect(within(section).getAllByRole('listitem')).toHaveLength(8)
  })

  it('leaves short lists alone', async () => {
    await userEvent.click(card('SS2'))
    const section = screen.getByRole('heading', { name: 'Affected intersections' }).parentElement!
    expect(within(section).queryByRole('button')).toBeNull()
  })
})

describe('touch', () => {
  it('places the cursor from a tap on the line rather than needing hover', async () => {
    const map = await mount()
    await userEvent.click(card('SS4'))

    const line = map.sources.get('detail-line') as { data: { features: { geometry: { coordinates: number[][] } }[] } }
    const [lng, lat] = line.data.features[0].geometry.coordinates[10]

    await act(async () =>
      map.fire('click', null, {
        defaultPrevented: false,
        point: { x: lng * 1000, y: lat * 1000 },
        lngLat: { lng, lat },
      }),
    )

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('SS4')
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toMatch(/km · /)
  })

  it('keeps a touch drag on the profile from being read as a hover exit', async () => {
    await mount()
    await userEvent.click(card('SS4'))
    const svg = profile()
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 400,
      top: 0,
      height: 132,
    } as DOMRect)

    fireEvent.pointerDown(svg, { pointerId: 1, pointerType: 'touch', clientX: 200 })
    fireEvent.pointerMove(svg, { pointerId: 1, pointerType: 'touch', clientX: 260 })
    const dragged = document.querySelector('[aria-live="polite"]')!.textContent

    fireEvent.pointerLeave(svg, { pointerId: 1, pointerType: 'touch' })
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe(dragged)
    expect(dragged).toMatch(/km · /)
  })
})

describe('URL state', () => {
  it('restores year, day, stage and time from a deep link', async () => {
    await mount('?year=2026&day=3&stage=SS25&t=14:30')

    expect(screen.getByRole('tab', { name: /Day 3/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('SS25')
    expect(screen.getByRole('status')).toHaveTextContent('14:30')
  })

  it('ignores an unusable deep link instead of failing to start', async () => {
    await mount('?year=1999&day=9&stage=nonsense&t=99:99')
    expect(screen.getByRole('tab', { name: /Day 1/ })).toHaveAttribute('aria-selected', 'true')
    expect(card('SS1')).toBeInTheDocument()
  })

  it('writes state back without adding history entries', async () => {
    const replace = vi.spyOn(window.history, 'replaceState')
    const push = vi.spyOn(window.history, 'pushState')
    window.history.replaceState(null, '', '/')
    replace.mockClear()

    await mount('', true)
    await userEvent.click(card('SS4'))

    expect(push).not.toHaveBeenCalled()
    expect(parseUrlState(window.location.search)).toMatchObject({
      year: 2026,
      day: 1,
      stage: 'SS4',
    })

    replace.mockRestore()
    push.mockRestore()
    window.history.replaceState(null, '', '/')
  })
})
