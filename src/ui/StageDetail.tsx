import { formatWindow } from '../domain/time'
import type { Cursor, RallyYear, StageDetail as StageDetailModel } from '../domain/types'
import { ElevationProfile } from './ElevationProfile'
import { GRADE_LEGEND, gradeColor } from './grade'
import { SafetyNotice, SourceNotice } from './SafetyNotice'

interface Props {
  year: RallyYear
  detail: StageDetailModel
  cursor: Cursor | null
  onCursor: (cursor: Cursor | null) => void
  onBack: () => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="detail__section">
      <h3>{title}</h3>
      <ul className="detail__chips">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export function StageDetail({ year, detail, cursor, onCursor, onBack }: Props) {
  const { closure, profile, spectator } = detail
  const repeatRuns = detail.runsAs.length > 1
  const source = year.sources.find((s) => s.mid === detail.line.properties.sourceMid)

  return (
    <div className="detail">
      <header className="detail__header">
        <button type="button" className="detail__back" onClick={onBack}>
          ← All day {detail.day} stages
        </button>
        <h2>
          <span className="detail__code">{detail.code}</span> {detail.name}
        </h2>
        <p className="detail__runs">
          Day {detail.day}
          {repeatRuns && ` · runs as ${detail.runsAs.join(' and ')}`}
        </p>
      </header>

      <section className="detail__section">
        <h3>Closure window</h3>
        <p className="detail__window">
          <span className="detail__window-clock">{formatWindow(closure)}</span>
          {!closure.confirmed && <span className="badge badge--provisional">Provisional</span>}
        </p>
        {!closure.confirmed && (
          <p className="detail__caveat">
            The organisers state that closure times for this day are yet to be confirmed.
          </p>
        )}
      </section>

      {profile && (
        <section className="detail__section">
          <h3>Elevation</h3>
          <ElevationProfile
            code={detail.code}
            profile={profile}
            cursor={cursor}
            onCursor={onCursor}
          />
          <div className="grade-legend" aria-hidden="true">
            {GRADE_LEGEND.map((g) => (
              <span key={g}>
                <i style={{ background: gradeColor(g) }} />
                {g > 0 ? `+${g}` : g}%
              </span>
            ))}
          </div>
          <div className="stat-strip">
            <Stat label="Length" value={`${profile.lengthKm.toFixed(2)} km`} />
            <Stat label="Climb" value={`${Math.round(profile.climbM)} m`} />
            <Stat label="Descent" value={`${Math.round(profile.descentM)} m`} />
            <Stat label="Net" value={`${profile.netM >= 0 ? '+' : ''}${Math.round(profile.netM)} m`} />
            <Stat label="Max grade" value={`${profile.maxGradePct.toFixed(1)}%`} />
          </div>
          <p className="detail__caveat">
            Elevation is sampled from open terrain tiles and smoothed over about 200 m. Gradients
            are indicative, not surveyed.
          </p>
        </section>
      )}

      <List title="Roads closed" items={closure.roadsClosed} />

      <section className="detail__section">
        <h3>Start and finish</h3>
        <dl className="detail__pairs">
          <dt>Start</dt>
          <dd>{closure.start}</dd>
          <dt>Finish</dt>
          <dd>{closure.finish}</dd>
        </dl>
      </section>

      <List title="Affected intersections" items={closure.intersections} />

      {repeatRuns && (
        <section className="detail__section">
          <h3>Repeat run</h3>
          <p>
            {detail.runsAs.join(' and ')} use this road. It stays closed between the runs, for the
            whole window above.
          </p>
        </section>
      )}

      {spectator && (
        <section className="detail__section">
          <h3>Spectating</h3>
          <p>{spectator.description}</p>
          <p>
            <a href={spectator.url} target="_blank" rel="noreferrer">
              {spectator.name}
            </a>
          </p>
        </section>
      )}

      {closure.notes.length > 0 && (
        <section className="detail__section">
          <h3>Notes</h3>
          <ul className="detail__notes">
            {closure.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="detail__footer">
        <SafetyNotice />
        <SourceNotice fetchedAt={source?.fetchedAt ?? year.sources[0]?.fetchedAt ?? null} />
        {detail.officialMapUrl && (
          <p className="source-notice">
            <a href={detail.officialMapUrl} target="_blank" rel="noreferrer">
              Organisers' Google map for {source?.documentName ?? `day ${detail.day}`}
            </a>
          </p>
        )}
      </footer>
    </div>
  )
}
