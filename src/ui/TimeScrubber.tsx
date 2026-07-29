import { formatClock, type Window } from '../domain/time'

export const STEP_MINUTES = 5

// A range thumb's centre travels from half a thumb in to half a thumb short of
// the end, so the track is narrower than the element. The Gantt insets its own
// scale by the same amount, which is what keeps the now-line under the thumb.
export const THUMB_PX = 16

interface Props {
  envelope: Window
  minutes: number
  onChange: (minutes: number) => void
  liveNow: number | null
}

export function TimeScrubber({ envelope, minutes, onChange, liveNow }: Props) {
  const isLive = liveNow !== null && Math.abs(liveNow - minutes) < STEP_MINUTES

  return (
    <div className="scrubber">
      <div className="scrubber__bar">
        <label className="scrubber__label" htmlFor="scrubber-input">
          Time of day
        </label>

        <output className="scrubber__readout" htmlFor="scrubber-input">
          {formatClock(minutes)}
          {isLive && <span className="badge badge--live">Now</span>}
        </output>

        {liveNow !== null && !isLive && (
          <button type="button" className="scrubber__now" onClick={() => onChange(liveNow)}>
            Jump to now
          </button>
        )}
      </div>

      <input
        id="scrubber-input"
        className="scrubber__input"
        type="range"
        min={envelope.closesAt}
        max={envelope.reopensAt}
        step={STEP_MINUTES}
        value={minutes}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={formatClock(minutes)}
      />
    </div>
  )
}
