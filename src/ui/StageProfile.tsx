import { ElevationProfile } from './ElevationProfile'
import { GRADE_LEGEND, gradeColor } from './grade'
import type { Cursor, StageDetail as StageDetailModel } from '../domain/types'

interface Props {
  detail: StageDetailModel
  cursor: Cursor | null
  onCursor: (cursor: Cursor | null) => void
}

function Stat({ label, value, modifier }: { label: string; value: string; modifier?: string }) {
  return (
    <div className={modifier ? `stat stat--${modifier}` : 'stat'}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  )
}

// Lives under the map rather than in the panel. At 360px the chart had no room
// to show a gradient and the stat strip wrapped into ragged rows.
export function StageProfile({ detail, cursor, onCursor }: Props) {
  const { profile } = detail
  if (!profile) return null

  return (
    <section className="profile-panel" aria-label={`Elevation profile for ${detail.code}`}>
      <div className="stat-strip">
        <Stat label="Length" value={`${profile.lengthKm.toFixed(2)} km`} />
        <Stat label="Climb" value={`${Math.round(profile.climbM)} m`} />
        <Stat label="Descent" value={`${Math.round(profile.descentM)} m`} />
        <Stat
          label="Net"
          modifier="net"
          // U+2212, not a hyphen: it aligns with the digits in the mono stack.
          value={`${profile.netM >= 0 ? '+' : '\u2212'}${Math.abs(Math.round(profile.netM))} m`}
        />
        <Stat label="Max grade" value={`${profile.maxGradePct.toFixed(1)}%`} />
      </div>

      <ElevationProfile
        code={detail.code}
        profile={profile}
        cursor={cursor}
        onCursor={onCursor}
      />

      <div className="profile-panel__foot">
        <div className="grade-legend" aria-hidden="true">
          <span className="grade-legend__title">Grade</span>
          {GRADE_LEGEND.map((g) => (
            <span key={g}>
              <i style={{ background: gradeColor(g) }} />
              {g > 0 ? `+${g}` : g}%
            </span>
          ))}
        </div>
        <p className="detail__caveat">
          Elevation is sampled from open terrain tiles and smoothed over about 200 m. Gradients are
          indicative, not surveyed.
        </p>
      </div>
    </section>
  )
}
