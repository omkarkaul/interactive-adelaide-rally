import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { loadYear } from '../src/domain/load'
import { availableYears } from '../src/domain/registry'
import { resolveStageDetail } from '../src/domain/detail'
import { featureForStage, stagesForDay, stagesSharingFeature } from '../src/domain/link'
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

afterEach(() => {
  maps.length = 0
})

// The whole point of the registry: a second year is a directory, not a change.
describe('a second year renders with no code change', () => {
  it('is discovered from the committed directory', () => {
    expect(availableYears()).toEqual([2026, 2025])
  })

  it('loads and links exactly like the real year', async () => {
    const year = await loadYear(2025)

    expect(year.event.days).toHaveLength(2)
    expect(stagesForDay(year, 1).map((s) => s.code)).toEqual(['SS1', 'SS2', 'SS3'])
    expect(featureForStage(year, 'SS1')).toBe(featureForStage(year, 'SS3'))
    expect(stagesSharingFeature(year, 'greenhill-loop').map((s) => s.code)).toEqual(['SS1', 'SS3'])
    expect(resolveStageDetail(year, 'SS1')!.runsAs).toEqual(['SS1', 'SS3'])
    expect(resolveStageDetail(year, 'SS2')!.spectator).not.toBeNull()
    expect(resolveStageDetail(year, 'SS1')!.profile).not.toBeNull()
  })

  it('returns no detail for a stage the organisers never mapped', async () => {
    const year = await loadYear(2025)
    expect(year.stages.find((s) => s.code === 'SS5')!.featureId).toBeNull()
    expect(featureForStage(year, 'SS5')).toBeNull()
    expect(resolveStageDetail(year, 'SS5')).toBeNull()
  })

  it('renders the app from the URL with two days and its own stage list', async () => {
    render(<App search="?year=2025" persistUrl={false} />)
    await screen.findByRole('tab', { name: /Day 1/ })
    await waitFor(() => expect(maps).toHaveLength(1))
    await act(async () => {
      maps[0].fireLoad()
    })

    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2025 Adelaide Rally')
    expect(screen.getAllByRole('button', { name: /^SS/ })).toHaveLength(3)
    expect(card('SS1')).toHaveTextContent('08:00–16:30')

    await userEvent.click(screen.getByRole('tab', { name: /Day 2/ }))
    expect(screen.getAllByRole('button', { name: /^SS/ })).toHaveLength(2)
  })

  it('renders a list-only card for the unmapped stage rather than failing', async () => {
    render(<App search="?year=2025&day=2" persistUrl={false} />)
    await screen.findByRole('tab', { name: /Day 2/ })
    await waitFor(() => expect(maps).toHaveLength(1))
    await act(async () => {
      maps[0].fireLoad()
    })

    expect(card('SS5')).toHaveTextContent('No map')
    await userEvent.click(card('SS5'))
    // No geometry means no detail view, so the list must stay put.
    expect(card('SS5')).toBeInTheDocument()
  })
})
