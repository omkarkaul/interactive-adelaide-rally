import type { RallyDay } from '../domain/types'

interface Props {
  days: RallyDay[]
  selected: number
  onSelect: (day: number) => void
}

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

export function DayTabs({ days, selected, onSelect }: Props) {
  return (
    <div className="day-tabs" role="tablist" aria-label="Rally day">
      {days.map((day) => (
        <button
          key={day.dayNumber}
          type="button"
          role="tab"
          id={`day-tab-${day.dayNumber}`}
          aria-selected={day.dayNumber === selected}
          aria-controls={`day-panel-${day.dayNumber}`}
          className={day.dayNumber === selected ? 'day-tab is-selected' : 'day-tab'}
          onClick={() => onSelect(day.dayNumber)}
        >
          <span className="day-tab__number">Day {day.dayNumber}</span>
          <span className="day-tab__date">{dateLabel(day.date)}</span>
        </button>
      ))}
    </div>
  )
}
