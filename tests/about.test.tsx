import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Root } from '../src/Root'
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

const go = (url: string) => window.history.replaceState(null, '', url)

describe('about page', () => {
  beforeEach(() => {
    maps.length = 0
  })

  afterEach(() => {
    maps.length = 0
    go('/')
  })

  it('renders at /about without a client-side navigation having happened', async () => {
    go('/about')
    render(<Root />)

    expect(await screen.findByText(/Made with/)).toBeInTheDocument()
    expect(screen.getByText(/Never enter a closed stage/)).toBeInTheDocument()
    expect(screen.getByText(/Why this exists/)).toBeInTheDocument()
    expect(screen.getByText(/And going forward/)).toBeInTheDocument()
  })

  it('never mounts the map', async () => {
    go('/about')
    render(<Root />)

    await screen.findByText(/Made with/)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(maps).toHaveLength(0)
  })

  it('reads the capture date out of sources.json', async () => {
    go('/about')
    render(<Root />)

    // Month name only — jsdom's ICU spells "July" where a browser spells "Jul".
    expect(await screen.findByText(/Captured 29 Jul\w* 2026\./)).toBeInTheDocument()
  })

  it('opens external links safely', async () => {
    go('/about')
    render(<Root />)

    const author = await screen.findByRole('link', { name: 'omkar' })
    expect(author).toHaveAttribute('href', 'https://www.rakmo.io')
    for (const link of [author, screen.getByRole('link', { name: 'adelaiderally.com.au' })]) {
      expect(link.getAttribute('rel')).toContain('noopener')
    }
  })

  it('is reachable from the header and keeps the day on the way back', async () => {
    go('/?year=2026&day=2')
    render(<Root />)

    const tab = await screen.findByRole('tab', { name: /Day 2/ })
    expect(tab).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('link', { name: 'About this project' }))
    expect(await screen.findByText(/Why this exists/)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/about')

    await act(async () => {
      window.history.back()
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Day 2/ })).toHaveAttribute('aria-selected', 'true'),
    )
  })
})
