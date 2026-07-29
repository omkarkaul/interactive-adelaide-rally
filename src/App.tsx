import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { loadYear } from './domain/load'
import { availableYears } from './domain/registry'
import { focusReducer, NO_FOCUS } from './domain/focus'
import { closuresForDay } from './domain/link'
import { resolveStageDetail } from './domain/detail'
import { clampToWindow, envelopeOf, minutesOfDay } from './domain/time'
import { RallyMap } from './map/RallyMap'
import { DayTabs } from './ui/DayTabs'
import { StagePanel } from './ui/StagePanel'
import { StageDetail } from './ui/StageDetail'
import { ClosureGantt } from './ui/ClosureGantt'
import { TimeScrubber } from './ui/TimeScrubber'
import { SafetyNotice, SourceNotice } from './ui/SafetyNotice'
import type { Cursor, RallyYear, StageCode } from './domain/types'

const PANEL_WIDTH = 360

// The scrubber starts on the clock if the user is looking during the event, and
// otherwise on the first road to close that day.
export function initialMinutes(
  envelope: { closesAt: number; reopensAt: number },
  liveNow: number | null,
): number {
  return liveNow === null ? envelope.closesAt : clampToWindow(liveNow, envelope)
}

export function liveMinutes(dayDate: string, now: Date): number | null {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
  return today === dayDate ? minutesOfDay(now) : null
}

export default function App() {
  const [year, setYear] = useState<RallyYear | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [day, setDay] = useState(1)
  const [focus, dispatch] = useReducer(focusReducer, NO_FOCUS)
  const [minutes, setMinutes] = useState<number | null>(null)
  const [cursor, setCursor] = useState<Cursor | null>(null)

  useEffect(() => {
    loadYear(availableYears()[0])
      .then(setYear)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const envelope = useMemo(
    () => (year ? envelopeOf(closuresForDay(year, day)) : null),
    [year, day],
  )

  const liveNow = useMemo(() => {
    const date = year?.event.days.find((d) => d.dayNumber === day)?.date
    return date ? liveMinutes(date, new Date()) : null
  }, [year, day])

  useEffect(() => {
    if (envelope) setMinutes(initialMinutes(envelope, liveNow))
  }, [envelope, liveNow])

  // The selected stage is the detail view: one selection, one place to look.
  const detail = useMemo(
    () => (year && focus.kind === 'selected' ? resolveStageDetail(year, focus.code) : null),
    [year, focus],
  )

  useEffect(() => setCursor(null), [detail?.code])

  const onHover = useCallback((code: StageCode | null) => {
    dispatch(code ? { type: 'hover', code } : { type: 'clear' })
  }, [])

  const onSelect = useCallback((code: StageCode | null) => {
    dispatch(code ? { type: 'toggle', code } : { type: 'clear' })
  }, [])

  const onSelectDay = useCallback((next: number) => {
    setDay(next)
    dispatch({ type: 'clear' })
  }, [])

  const onBack = useCallback(() => dispatch({ type: 'clear' }), [])

  if (error) {
    return (
      <div className="app app--message" role="alert">
        <p>Could not load the rally data: {error}</p>
      </div>
    )
  }

  if (!year || !envelope || minutes === null) {
    return (
      <div className="app app--message" aria-busy="true">
        <p>Loading stages…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title">
          <h1>{year.event.name}</h1>
          <p>Stages and road closures</p>
        </div>
        <DayTabs days={year.event.days} selected={day} onSelect={onSelectDay} />
      </header>

      <main className="app__body">
        <aside className="app__panel" style={{ width: PANEL_WIDTH }}>
          {detail ? (
            <StageDetail
              year={year}
              detail={detail}
              cursor={cursor}
              onCursor={setCursor}
              onBack={onBack}
            />
          ) : (
            <>
              <StagePanel
                year={year}
                day={day}
                focus={focus}
                minutes={minutes}
                onHover={onHover}
                onSelect={onSelect}
              />
              <footer className="app__panel-footer">
                <SafetyNotice />
                <SourceNotice fetchedAt={year.sources[0]?.fetchedAt ?? null} />
              </footer>
            </>
          )}
        </aside>

        <div className="app__map">
          <RallyMap
            year={year}
            day={day}
            focus={focus}
            minutes={minutes}
            onHover={onHover}
            onSelect={onSelect}
            panelWidth={PANEL_WIDTH}
            detail={detail}
            cursor={cursor}
            onCursor={setCursor}
          />
        </div>
      </main>

      <section className="app__time" aria-label="Road closure timeline">
        <TimeScrubber
          envelope={envelope}
          minutes={minutes}
          onChange={setMinutes}
          liveNow={liveNow}
        />
        <ClosureGantt
          year={year}
          day={day}
          focus={focus}
          minutes={minutes}
          onHover={onHover}
          onSelect={onSelect}
        />
      </section>
    </div>
  )
}
