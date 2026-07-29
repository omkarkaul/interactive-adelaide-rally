import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DayTabs } from './DayTabs'
import type { RallyDay } from '../domain/types'

const days: RallyDay[] = [
  { dayNumber: 1, date: '2026-10-16', label: 'Day 1 — Friday 16 October' },
  { dayNumber: 2, date: '2026-10-17', label: 'Day 2 — Saturday 17 October' },
  { dayNumber: 3, date: '2026-10-18', label: 'Day 3 — Sunday 18 October' },
]

describe('DayTabs', () => {
  it('renders one tab per day with its date', () => {
    render(<DayTabs days={days} selected={1} onSelect={() => {}} />)
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tab', { name: /Day 2/ })).toHaveTextContent('17 Oct')
  })

  it('marks only the selected day', () => {
    render(<DayTabs days={days} selected={2} onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: /Day 2/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Day 1/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('reports the day that was clicked', async () => {
    const onSelect = vi.fn()
    render(<DayTabs days={days} selected={1} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('tab', { name: /Day 3/ }))
    expect(onSelect).toHaveBeenCalledWith(3)
  })
})
