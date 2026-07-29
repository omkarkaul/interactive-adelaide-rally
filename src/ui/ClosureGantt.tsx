import { emphasis } from '../domain/focus'
import { closuresForDay, stagesForDay } from '../domain/link'
import { formatClock, isClosedAt, windowOf } from '../domain/time'
import type { Focus, RallyYear, StageCode } from '../domain/types'
import { COLOR } from '../map/layers'
import { useElementSize } from './useElementSize'

const ROW_HEIGHT = 22
const BAR_HEIGHT = 12
const AXIS_HEIGHT = 18

interface Props {
  year: RallyYear
  day: number
  focus: Focus
  minutes: number
  onHover: (code: StageCode | null) => void
  onSelect: (code: StageCode | null) => void
}

function hourTicks(from: number, to: number): number[] {
  const ticks: number[] = []
  for (let t = Math.ceil(from / 60) * 60; t <= to; t += 60) ticks.push(t)
  return ticks
}

export function ClosureGantt({ year, day, focus, minutes, onHover, onSelect }: Props) {
  const [ref, { width }] = useElementSize<HTMLDivElement>()

  const closures = closuresForDay(year, day)
  const stages = stagesForDay(year, day)
  const windows = closures.map(windowOf)
  const from = Math.min(...windows.map((w) => w.closesAt))
  const to = Math.max(...windows.map((w) => w.reopensAt))

  const height = closures.length * ROW_HEIGHT + AXIS_HEIGHT
  const x = (m: number) => (width === 0 ? 0 : ((m - from) / (to - from)) * width)

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
          {/* Days 2 and 3 are unconfirmed, so their bars fade out rather than
              ending on a hard edge that would read as a committed time. */}
          <linearGradient id="gantt-provisional" x1="0" x2="1">
            <stop offset="0" stopColor={COLOR.line} stopOpacity="0.15" />
            <stop offset="0.12" stopColor={COLOR.line} stopOpacity="0.55" />
            <stop offset="0.88" stopColor={COLOR.line} stopOpacity="0.55" />
            <stop offset="1" stopColor={COLOR.line} stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="gantt-provisional-closed" x1="0" x2="1">
            <stop offset="0" stopColor={COLOR.closed} stopOpacity="0.2" />
            <stop offset="0.12" stopColor={COLOR.closed} stopOpacity="0.8" />
            <stop offset="0.88" stopColor={COLOR.closed} stopOpacity="0.8" />
            <stop offset="1" stopColor={COLOR.closed} stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {hourTicks(from, to).map((tick) => (
          <g key={tick}>
            <line
              className="gantt__tick"
              x1={x(tick)}
              x2={x(tick)}
              y1={0}
              y2={height - AXIS_HEIGHT}
            />
            <text className="gantt__tick-label" x={x(tick)} y={height - 5} textAnchor="middle">
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
          const closed = isClosedAt(closure, minutes)

          const fill = closure.confirmed
            ? closed
              ? COLOR.closed
              : COLOR.line
            : closed
              ? 'url(#gantt-provisional-closed)'
              : 'url(#gantt-provisional)'

          return (
            <g
              key={closure.id}
              className={`gantt__row${focused ? ' is-focused' : ''}${dimmed ? ' is-dimmed' : ''}`}
              onMouseEnter={() => onHover(code)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(code)}
            >
              <rect
                className="gantt__row-hit"
                x={0}
                y={index * ROW_HEIGHT}
                width={width}
                height={ROW_HEIGHT}
              />
              <rect
                className="gantt__bar"
                x={x(window.closesAt)}
                y={index * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2}
                width={Math.max(1, x(window.reopensAt) - x(window.closesAt))}
                height={BAR_HEIGHT}
                rx={2}
                fill={fill}
              />
              <text
                className="gantt__bar-label"
                x={x(window.closesAt) + 5}
                y={index * ROW_HEIGHT + ROW_HEIGHT / 2 + 3.5}
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
          y1={0}
          y2={height - AXIS_HEIGHT}
        />
      </svg>
    </div>
  )
}
