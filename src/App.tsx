import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { loadYear } from './domain/load'
import { availableYears } from './domain/registry'
import { focusReducer, NO_FOCUS } from './domain/focus'
import { closuresForDay } from './domain/link'
import { resolveStageDetail } from './domain/detail'
import { clampToWindow, envelopeOf, minutesOfDay } from './domain/time'
import { DayTabs } from './ui/DayTabs'
import { StagePanel } from './ui/StagePanel'
import { StageDetail } from './ui/StageDetail'
import { ClosureGantt } from './ui/ClosureGantt'
import { TimeScrubber } from './ui/TimeScrubber'
import { SafetyNotice, SourceNotice } from './ui/SafetyNotice'
import { parseUrlState, toSearch } from './url'
import type { Cursor, RallyYear, StageCode } from './domain/types'

// MapLibre is over a megabyte and blocks first paint if it is in the entry
// chunk. The stage list and closure times are readable without it.
const RallyMap = lazy(() =>
  import('./map/RallyMap').then((module) => ({ default: module.RallyMap })),
)

const PANEL_WIDTH = 360
const NARROW = '(max-width: 860px)'

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(NARROW).matches,
  )

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const query = matchMedia(NARROW)
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return narrow
}

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

interface AppProps {
  // Taken as arguments rather than read off the global so the app can be
  // mounted repeatedly in one document without inheriting the last mount's URL.
  search?: string
  persistUrl?: boolean
}

export default function App({
  search: initialSearch = window.location.search,
  persistUrl = true,
}: AppProps = {}) {
  const initial = useMemo(() => parseUrlState(initialSearch), [initialSearch])
  const narrow = useIsNarrow()

  const [year, setYear] = useState<RallyYear | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [day, setDay] = useState(initial.day ?? 1)
  const [focus, dispatch] = useReducer(
    focusReducer,
    initial.stage ? ({ kind: 'selected', code: initial.stage } as const) : NO_FOCUS,
  )
  const [minutes, setMinutes] = useState<number | null>(null)
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const restoredTime = useRef(initial.minutes)

  useEffect(() => {
    const years = availableYears()
    const wanted = initial.year && years.includes(initial.year) ? initial.year : years[0]
    loadYear(wanted)
      .then(setYear)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [initial.year])

  // A day from the URL that the loaded year does not have would leave the app
  // with no closure envelope and nothing to render, so it falls back.
  useEffect(() => {
    if (year && !year.event.days.some((d) => d.dayNumber === day)) {
      setDay(year.event.days[0].dayNumber)
    }
  }, [year, day])

  const envelope = useMemo(
    () => (year ? envelopeOf(closuresForDay(year, day)) : null),
    [year, day],
  )

  const liveNow = useMemo(() => {
    const date = year?.event.days.find((d) => d.dayNumber === day)?.date
    return date ? liveMinutes(date, new Date()) : null
  }, [year, day])

  useEffect(() => {
    if (!envelope) return
    // A time in the URL wins once, on first load; day changes then rebase normally.
    const restored = restoredTime.current
    restoredTime.current = null
    setMinutes(
      restored === null ? initialMinutes(envelope, liveNow) : clampToWindow(restored, envelope),
    )
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

  // replaceState, not pushState: scrubbing time would otherwise bury the back
  // button under hundreds of entries.
  useEffect(() => {
    if (!persistUrl || !year || minutes === null) return
    const search = toSearch({
      year: year.event.year,
      day,
      stage: focus.kind === 'selected' ? focus.code : null,
      minutes,
    })
    if (search !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${search}`)
    }
  }, [persistUrl, year, day, focus, minutes])

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
    <div className={narrow ? 'app is-narrow' : 'app'}>
      <header className="app__header">
        <div className="app__title">
          <h1>{year.event.name}</h1>
          <p>Stages and road closures</p>
        </div>
        <DayTabs days={year.event.days} selected={day} onSelect={onSelectDay} />
      </header>

      <main className="app__body">
        <aside className="app__panel">
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
          <Suspense fallback={<div className="app__map-loading">Loading map…</div>}>
            <RallyMap
              year={year}
              day={day}
              focus={focus}
              minutes={minutes}
              onHover={onHover}
              onSelect={onSelect}
              panelWidth={narrow ? 0 : PANEL_WIDTH}
              detail={detail}
              cursor={cursor}
              onCursor={setCursor}
            />
          </Suspense>
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
