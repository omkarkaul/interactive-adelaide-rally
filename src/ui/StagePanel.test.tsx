import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { StagePanel } from './StagePanel'
import { loadYear } from '../domain/load'
import { parseClock } from '../domain/time'
import type { Focus, RallyYear } from '../domain/types'

let year: RallyYear
beforeAll(async () => {
  year = await loadYear(2026)
})

const panel = (props: Partial<Parameters<typeof StagePanel>[0]> = {}) =>
  render(
    <StagePanel
      year={year}
      day={1}
      focus={{ kind: 'none' }}
      minutes={null}
      onHover={() => {}}
      onSelect={() => {}}
      {...props}
    />,
  )

const cards = () => screen.getAllByRole('button')

// The repeat-run note names the sibling stage, so a card has to be matched on
// the code it opens with rather than on any mention of that code.
const card = (code: string) => screen.getByRole('button', { name: new RegExp(`^${code}\\b`) })

describe('StagePanel', () => {
  it('lists the day in run order with windows and roads', () => {
    panel()
    expect(cards()).toHaveLength(11)
    expect(cards()[0]).toHaveTextContent('SS1')
    expect(cards()[0]).toHaveTextContent('Beaumont')
    expect(cards()[0]).toHaveTextContent('07:45–12:45')
    expect(cards()[0]).toHaveTextContent('Hayward Dve')
    expect(cards().at(-1)).toHaveTextContent('SS11')
  })

  it('switches to another day', () => {
    panel({ day: 3 })
    expect(cards()).toHaveLength(8)
    expect(cards()[0]).toHaveTextContent('SS23')
  })

  it('focuses one stage and dims the rest', () => {
    const focus: Focus = { kind: 'selected', code: 'SS4' }
    panel({ focus })
    const selected = card('SS4')
    expect(selected).toHaveClass('is-focused')
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(card('SS1')).toHaveClass('is-dimmed')
  })

  it('dims nothing while nothing is focused', () => {
    panel()
    for (const each of cards()) expect(each).toHaveClass('is-normal')
  })

  it('badges provisional windows on unconfirmed days only', () => {
    const { unmount } = panel({ day: 1 })
    expect(screen.queryAllByText('Provisional')).toHaveLength(0)
    unmount()
    panel({ day: 2 })
    expect(screen.queryAllByText('Provisional')).toHaveLength(11)
  })

  it('badges the spectator stages', () => {
    panel({ day: 3 })
    const strathalbyn = card('SS25')
    expect(within(strathalbyn).getByText('Spectator')).toBeInTheDocument()
    expect(within(card('SS24')).queryByText('Spectator')).toBeNull()
  })

  it('notes that the road stays closed between repeat runs', () => {
    panel({ day: 1 })
    expect(card('SS4')).toHaveTextContent(
      'Road stays closed between runs: SS4 and SS7',
    )
    expect(card('SS1')).not.toHaveTextContent(
      'Road stays closed',
    )
  })

  it('marks a stage closed at the scrubbed time', () => {
    panel({ day: 1, minutes: parseClock('10:00') })
    expect(card('SS4')).toHaveClass('is-closed')
    expect(card('SS11')).not.toHaveClass('is-closed')
  })

  it('reports hover and selection', async () => {
    const onHover = vi.fn()
    const onSelect = vi.fn()
    panel({ onHover, onSelect })

    await userEvent.hover(card('SS2'))
    expect(onHover).toHaveBeenCalledWith('SS2')

    await userEvent.unhover(card('SS2'))
    expect(onHover).toHaveBeenCalledWith(null)

    await userEvent.click(card('SS2'))
    expect(onSelect).toHaveBeenCalledWith('SS2')
  })
})
