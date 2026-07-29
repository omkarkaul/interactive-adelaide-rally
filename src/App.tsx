import { useCallback, useEffect, useReducer, useState } from 'react'
import { loadYear } from './domain/load'
import { availableYears } from './domain/registry'
import { focusReducer, NO_FOCUS } from './domain/focus'
import { RallyMap } from './map/RallyMap'
import { DayTabs } from './ui/DayTabs'
import { StagePanel } from './ui/StagePanel'
import { SafetyNotice, SourceNotice } from './ui/SafetyNotice'
import type { RallyYear, StageCode } from './domain/types'

const PANEL_WIDTH = 360

export default function App() {
  const [year, setYear] = useState<RallyYear | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [day, setDay] = useState(1)
  const [focus, dispatch] = useReducer(focusReducer, NO_FOCUS)

  useEffect(() => {
    loadYear(availableYears()[0])
      .then(setYear)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

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

  if (error) {
    return (
      <div className="app app--message" role="alert">
        <p>Could not load the rally data: {error}</p>
      </div>
    )
  }

  if (!year) {
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
          <StagePanel
            year={year}
            day={day}
            focus={focus}
            minutes={null}
            onHover={onHover}
            onSelect={onSelect}
          />
          <footer className="app__panel-footer">
            <SafetyNotice />
            <SourceNotice fetchedAt={year.sources[0]?.fetchedAt ?? null} />
          </footer>
        </aside>

        <div className="app__map">
          <RallyMap
            year={year}
            day={day}
            focus={focus}
            minutes={null}
            onHover={onHover}
            onSelect={onSelect}
            panelWidth={PANEL_WIDTH}
          />
        </div>
      </main>
    </div>
  )
}
