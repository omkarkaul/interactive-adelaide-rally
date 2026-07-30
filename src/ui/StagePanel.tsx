import { emphasis } from '../domain/focus'
import { closureForStage, stagesForDay } from '../domain/link'
import { formatWindow } from '../domain/time'
import type { Focus, RallyYear, StageCode } from '../domain/types'
import { closureStateAt } from './closureState'

interface Props {
  year: RallyYear
  day: number
  focus: Focus
  minutes: number | null
  onHover: (code: StageCode | null) => void
  onSelect: (code: StageCode | null) => void
}

export function StagePanel({ year, day, focus, minutes, onHover, onSelect }: Props) {
  const stages = stagesForDay(year, day)

  return (
    <div
      className="stage-panel"
      id={`day-panel-${day}`}
      role="tabpanel"
      aria-labelledby={`day-tab-${day}`}
    >
      <ul className="stage-list">
        {stages.map((stage) => {
          const closure = closureForStage(year, stage.code)!
          const mark = emphasis(focus, stage.code)
          const closureState = closureStateAt(closure, minutes)
          const closed = closureState === 'closed'

          return (
            <li key={stage.code}>
              <button
                type="button"
                className={`stage-card is-${mark} is-${closureState}${closed ? ' is-closed' : ''}`}
                aria-pressed={focus.kind === 'selected' && focus.code === stage.code}
                onMouseEnter={() => onHover(stage.code)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(stage.code)}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(stage.code)}
              >
                <span className="stage-card__head">
                  <span className="stage-card__code">{stage.code}</span>
                  <span className="stage-card__name">{stage.name}</span>
                  {stage.spectator && <span className="badge badge--spectator">Spectator</span>}
                </span>

                <span className="stage-card__window">
                  <span className={closed ? 'clock is-closed' : 'clock'}>
                    {formatWindow(closure)}
                  </span>
                  {!closure.confirmed && <span className="badge badge--provisional">Provisional</span>}
                  {stage.featureId === null && <span className="badge">No map</span>}
                </span>

                <span className="stage-card__roads">{closure.roadsClosed.join(' · ')}</span>

                {closure.stageCodes.length > 1 && (
                  <span className="stage-card__note">
                    Road stays closed between runs: {closure.stageCodes.join(' and ')}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
