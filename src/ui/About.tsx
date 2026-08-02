import { useEffect, useState } from 'react'
import { availableYears, eventLoader, sourcesLoader } from '../domain/registry'
import { ABOUT_PATH, MAP_PATH } from '../route'
import { Link } from './Link'
import { captureDate, OFFICIAL_CLOSURES_URL } from './SafetyNotice'
import type { RallyEvent, SourceRecord } from '../domain/types'

const AUTHOR_URL = 'https://www.rakmo.io'

interface Meta {
  name: string
  fetchedAt: string | null
}

// event.json and sources.json only. loadYear would drag in ~800kB of day
// geometry that nothing on this page draws.
async function loadMeta(year: number): Promise<Meta> {
  const [eventFile, sourcesFile] = await Promise.all([
    eventLoader(year)() as Promise<{ event: RallyEvent }>,
    sourcesLoader(year)() as Promise<{ sources: SourceRecord[] }>,
  ])
  return { name: eventFile.event.name, fetchedAt: sourcesFile.sources[0]?.fetchedAt ?? null }
}

function Heart() {
  return (
    <span className="heart" role="img" aria-label="love">
      ❤️
    </span>
  )
}

export function AboutLink({ onNavigate }: { onNavigate?: (to: string) => void }) {
  return (
    <Link to={ABOUT_PATH} className="made-with" label="About this project" onNavigate={onNavigate}>
      <span className="made-with__text">made with</span>
      <Heart />
    </Link>
  )
}

export function About({ onNavigate }: { onNavigate?: (to: string) => void }) {
  const [meta, setMeta] = useState<Meta | null>(null)

  useEffect(() => {
    let live = true
    const settle = (next: Meta) => {
      if (live) setMeta(next)
    }
    loadMeta(availableYears()[0])
      .then(settle)
      .catch(() => settle({ name: 'Adelaide Rally', fetchedAt: null }))
    return () => {
      live = false
    }
  }, [])

  if (!meta) return <div className="app app--message" aria-busy="true" />

  const captured = captureDate(meta.fetchedAt)

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title">
          <h1>{meta.name}</h1>
          <p>Stages and road closures</p>
        </div>
      </header>

      <main className="about__body">
        <div className="about__col">
          <Link to={MAP_PATH} className="about__back" onNavigate={onNavigate}>
            ← Back to the map
          </Link>

          <p className="about__by">
            Made with <Heart /> by{' '}
            <a className="about__link" href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
              omkar
            </a>
          </p>

          <aside className="safety-notice about__notice" role="note">
            Rally cars are fast, and a closed road stays closed between runs. Spectate only from
            approved areas and never enter a closed stage.
          </aside>

          <section className="about__section">
            <h2>Why this exists</h2>
            <p>
              The official route and closures live on two separate pages as a grid of images on one,
              and a wall of prose on the other. This is mostly the same information on a single interactive map, by day,
              with every stage attached. We go a bit further by including gradient and general metadata per stage,
              and setting up a system for provenance.
            </p>
          </section>

          <section className="about__section">
            <h2>Going forward</h2>
            <p>
              No public record of past years is publicly surfaced, so going forward each year will be captured here from the
              source, checksummed and committed, so we can build a system of record for the Adelaide Rally.
            </p>
          </section>

          <footer className="about__footer">
            Not the official source. Route and closure data belongs to the organisers —{' '}
            <a
              className="about__link"
              href={OFFICIAL_CLOSURES_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              adelaiderally.com.au
            </a>
            .{captured ? ` Captured ${captured}.` : ''}
          </footer>
        </div>
      </main>
    </div>
  )
}
