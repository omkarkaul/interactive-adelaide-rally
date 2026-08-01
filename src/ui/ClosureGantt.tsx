import { emphasis } from '../domain/focus'
import { closuresForDay, stagesForDay } from '../domain/link'
import { formatClock, windowOf } from '../domain/time'
import type { Focus, RallyYear, StageCode } from '../domain/types'
import { token } from '../tokens'
import { closureStateAt, type ClosureState } from './closureState'
import { THUMB_PX } from './TimeScrubber'
import { useElementSize } from './useElementSize'

const ROW_HEIGHT = 22
const BAR_HEIGHT = 12
const AXIS_HEIGHT = 18
const MIN_TICK_GAP_PX = 46
const CAP_PX = 4

// Row labels live in a gutter rather than on top of the bars. Printed inside,
// they made a ragged staircase, sat on fills too dark to read against, and the
// now-line sliced straight through any label near the current time. Read from
// the token the scrubber indents by, so the two cannot disagree.
export const GUTTER_PX = Number.parseFloat(token('--gantt-gutter'))

const STATE_COLOR: Record<ClosureState, string> = {
  pending: token('--state-pending'),
  closed: token('--state-closed'),
  reopened: token('--state-reopened'),
}

interface Props {
  year: RallyYear
  day: number
  focus: Focus
  minutes: number
  onHover: (code: StageCode | null) => void
  onSelect: (code: StageCode | null) => void
}

// The Gantt and the scrubber have to share one scale, or the now-line does not
// sit under the thumb. A native range thumb's centre travels from half a thumb
// in to half a thumb short of the far edge, so this maps the same span.
export function timeScale(width: number, from: number, to: number, gutter = 0) {
  const track = Math.max(0, width - gutter - THUMB_PX)
  const span = to - from
  const origin = gutter + THUMB_PX / 2
  return (minutes: number) =>
    track === 0 || span === 0 ? origin : origin + ((minutes - from) / span) * track
}

// Hourly ticks collide below about 700px, so the step widens to two hours and
// then three rather than overprinting the labels.
export function hourTicks(from: number, to: number, width: number): number[] {
  const hours = Math.max(1, (to - from) / 60)
  const perHour = width / hours
  const step = perHour >= MIN_TICK_GAP_PX ? 1 : perHour * 2 >= MIN_TICK_GAP_PX ? 2 : 3

  const ticks: number[] = []
  for (let t = Math.ceil(from / 60) * 60; t <= to; t += 60) {
    if ((t / 60) % step === 0) ticks.push(t)
  }
  return ticks
}

export function ClosureGantt({ year, day, focus, minutes, onHover, onSelect }: Props) {
  const [ref, { width }] = useElementSize<HTMLDivElement>()

  const closures = closuresForDay(year, day)
  const stages = stagesForDay(year, day)
  const windows = closures.map(windowOf)
  const from = Math.min(...windows.map((w) => w.closesAt))
  const to = Math.max(...windows.map((w) => w.reopensAt))

  // The axis sits at the top, directly under the scrubber it shares a scale
  // with, rather than at the bottom where it drifts away from the control.
  const height = AXIS_HEIGHT + closures.length * ROW_HEIGHT
  const track = Math.max(0, width - GUTTER_PX - THUMB_PX)
  const x = timeScale(width, from, to, GUTTER_PX)

  return (
    <div className="gantt" ref={ref}>
      <svg
        className="gantt__svg"
        width={width}
        height={height}
        role="img"
        aria-label={`Road closure windows for day ${day}, ${formatClock(from)} to ${formatClock(to)}`}
      >
        <defs>
          {/* Days 2 and 3 are unconfirmed. Their bars end in dashes so that no
              edge reads as a committed time. */}
          {(Object.keys(STATE_COLOR) as ClosureState[]).map((s) => (
            <pattern
              key={s}
              id={`gantt-cap-${s}`}
              width={CAP_PX}
              height={CAP_PX}
              patternUnits="userSpaceOnUse"
            >
              <rect width={CAP_PX / 2} height={CAP_PX} fill={STATE_COLOR[s]} />
            </pattern>
          ))}
        </defs>

        {hourTicks(from, to, track).map((tick) => (
          <g key={tick}>
            <line className="gantt__tick" x1={x(tick)} x2={x(tick)} y1={AXIS_HEIGHT} y2={height} />
            <text className="gantt__tick-label" x={x(tick)} y={AXIS_HEIGHT - 6} textAnchor="middle">
              {formatClock(tick)}
            </text>
          </g>
        ))}

        {closures.map((closure, index) => {
          const window = windows[index]
          const owners = stages.filter((s) => closure.stageCodes.includes(s.code))
          const code = owners[0]?.code ?? closure.stageCodes[0]
          const mark = owners.length
            ? owners.map((s) => emphasis(focus, s.code))
            : [emphasis(focus, code)]
          const focused = mark.includes('focused')
          const dimmed = mark.every((m) => m === 'dimmed')
          const closureState = closureStateAt(closure, minutes)

          // Ink decreases as a closure completes: solid grey while pending, solid
          // red while closed, a dashed outline once reopened. That matches the map,
          // where reopened is the thinnest and the only dashed line. Filling the
          // pending bar and hollowing the reopened one used to invert the two.
          const outlined = closureState === 'reopened'
          const barX = x(window.closesAt)
          const barWidth = Math.max(1, x(window.reopensAt) - barX)
          const barY = AXIS_HEIGHT + index * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2
          const caps = !closure.confirmed && barWidth > CAP_PX * 3

          return (
            <g
              key={closure.id}
              className={`gantt__row is-${closureState}${focused ? ' is-focused' : ''}${dimmed ? ' is-dimmed' : ''}${closure.confirmed ? '' : ' is-provisional'}`}
              onMouseEnter={() => onHover(code)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(code)}
            >
              <rect
                className="gantt__row-hit"
                x={0}
                y={AXIS_HEIGHT + index * ROW_HEIGHT}
                width={width}
                height={ROW_HEIGHT}
              />
              <rect
                className="gantt__bar"
                x={caps ? barX + CAP_PX : barX}
                y={barY}
                width={caps ? barWidth - CAP_PX * 2 : barWidth}
                height={BAR_HEIGHT}
                rx={3}
                fill={outlined ? 'none' : STATE_COLOR[closureState]}
                stroke={outlined ? STATE_COLOR[closureState] : 'none'}
                strokeWidth={outlined ? 1 : 0}
                strokeDasharray={outlined ? '3 2' : undefined}
              />
              {caps &&
                [barX, barX + barWidth - CAP_PX].map((capX) => (
                  <rect
                    key={capX}
                    x={capX}
                    y={barY}
                    width={CAP_PX}
                    height={BAR_HEIGHT}
                    fill={`url(#gantt-cap-${closureState})`}
                  />
                ))}
              <text
                className="gantt__bar-label"
                x={GUTTER_PX - 8}
                y={AXIS_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2 + 3.5}
                textAnchor="end"
              >
                {closure.stageCodes.join(' / ')}
              </text>
            </g>
          )
        })}

        <line
          className="gantt__now"
          x1={x(minutes)}
          x2={x(minutes)}
          y1={AXIS_HEIGHT}
          y2={height}
        />

        {/* The scrubber's clock sits at the far right of the bar, a screen away
            from the line it describes. This is the same value, on the line. */}
        <g className="gantt__now-flag" transform={`translate(${x(minutes)}, 0)`}>
          <rect x={-22} y={0} width={44} height={AXIS_HEIGHT - 3} rx={2} />
          <text x={0} y={AXIS_HEIGHT - 8} textAnchor="middle">
            {formatClock(minutes)}
          </text>
        </g>
      </svg>

      {/* Three encodings are in play now — fill, outline and dash — so the key
          carries more than it did when state was colour alone. */}
      <ul className="gantt__legend">
        <li>
          <span className="gantt__key gantt__key--pending" /> not yet closed
        </li>
        <li>
          <span className="gantt__key gantt__key--closed" /> closed now
        </li>
        <li>
          <span className="gantt__key gantt__key--reopened" /> reopened
        </li>
      </ul>
    </div>
  )
}
