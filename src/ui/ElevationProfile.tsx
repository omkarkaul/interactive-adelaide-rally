import { useCallback, useMemo } from 'react'
import { sampleAtDistance } from '../domain/profile'
import type { Cursor, Profile, StageCode } from '../domain/types'
import { gradeColor } from './grade'
import { useElementSize } from './useElementSize'

const HEIGHT = 132
const PAD = { top: 10, right: 8, bottom: 20, left: 34 }
const MAX_SEGMENTS = 320

interface Props {
  code: StageCode
  profile: Profile
  cursor: Cursor | null
  onCursor: (cursor: Cursor | null) => void
}

export function ElevationProfile({ code, profile, cursor, onCursor }: Props) {
  const [ref, { width }] = useElementSize<HTMLDivElement>()

  const plotWidth = Math.max(0, width - PAD.left - PAD.right)
  const plotHeight = HEIGHT - PAD.top - PAD.bottom

  const { minM, maxM } = useMemo(() => {
    const elevations = profile.samples.map((s) => s.elevationM)
    const low = Math.min(...elevations)
    const high = Math.max(...elevations)
    const padding = Math.max(5, (high - low) * 0.08)
    return { minM: low - padding, maxM: high + padding }
  }, [profile])

  const x = useCallback(
    (km: number) => PAD.left + (profile.lengthKm ? (km / profile.lengthKm) * plotWidth : 0),
    [profile.lengthKm, plotWidth],
  )
  const y = useCallback(
    (m: number) => PAD.top + plotHeight - ((m - minM) / (maxM - minM || 1)) * plotHeight,
    [minM, maxM, plotHeight],
  )

  // One path per sample pair would be a thousand nodes on the longer stages, so
  // the drawn series is thinned while the data behind the cursor stays complete.
  const segments = useMemo(() => {
    const step = Math.max(1, Math.ceil(profile.samples.length / MAX_SEGMENTS))
    const out: { d: string; color: string }[] = []
    for (let i = step; i < profile.samples.length; i += step) {
      const a = profile.samples[i - step]
      const b = profile.samples[i]
      out.push({
        d: `M${x(a.distanceKm)},${y(a.elevationM)}L${x(b.distanceKm)},${y(b.elevationM)}`,
        color: gradeColor(b.gradePct),
      })
    }
    return out
  }, [profile, x, y])

  const area = useMemo(() => {
    const step = Math.max(1, Math.ceil(profile.samples.length / MAX_SEGMENTS))
    const points = profile.samples
      .filter((_, i) => i % step === 0 || i === profile.samples.length - 1)
      .map((s) => `${x(s.distanceKm)},${y(s.elevationM)}`)
    const base = PAD.top + plotHeight
    return `M${PAD.left},${base}L${points.join('L')}L${x(profile.lengthKm)},${base}Z`
  }, [profile, x, y, plotHeight])

  const pointerToCursor = useCallback(
    (clientX: number, target: SVGSVGElement) => {
      const box = target.getBoundingClientRect()
      const ratio = (clientX - box.left - PAD.left) / (plotWidth || 1)
      const distanceKm = Math.min(profile.lengthKm, Math.max(0, ratio * profile.lengthKm))
      onCursor({ code, distanceKm })
    },
    [code, profile.lengthKm, plotWidth, onCursor],
  )

  const active = cursor?.code === code ? sampleAtDistance(profile, cursor.distanceKm) : null

  return (
    <div className="profile" ref={ref}>
      <svg
        className="profile__svg"
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Elevation profile for ${code}: ${profile.lengthKm.toFixed(1)} kilometres, ${Math.round(profile.climbM)} metres of climbing`}
        onPointerMove={(event) => pointerToCursor(event.clientX, event.currentTarget)}
        onPointerDown={(event) => pointerToCursor(event.clientX, event.currentTarget)}
        onPointerLeave={() => onCursor(null)}
      >
        <path className="profile__area" d={area} />

        {segments.map((segment, index) => (
          <path key={index} d={segment.d} stroke={segment.color} className="profile__segment" />
        ))}

        {[minM, (minM + maxM) / 2, maxM].map((m) => (
          <text key={m} className="profile__axis" x={PAD.left - 5} y={y(m) + 3} textAnchor="end">
            {Math.round(m)}
          </text>
        ))}

        <text className="profile__axis" x={PAD.left} y={HEIGHT - 6}>
          0 km
        </text>
        <text className="profile__axis" x={width - PAD.right} y={HEIGHT - 6} textAnchor="end">
          {profile.lengthKm.toFixed(2)} km
        </text>

        {active && (
          <g className="profile__cursor">
            <line
              x1={x(active.distanceKm)}
              x2={x(active.distanceKm)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
            />
            <circle cx={x(active.distanceKm)} cy={y(active.elevationM)} r={4} />
          </g>
        )}
      </svg>

      <p className="profile__readout" aria-live="polite">
        {active
          ? `${active.distanceKm.toFixed(2)} km · ${Math.round(active.elevationM)} m · ${active.gradePct >= 0 ? '+' : ''}${active.gradePct.toFixed(1)}%`
          : 'Hover the profile or the map line to read distance, elevation and grade.'}
      </p>
    </div>
  )
}
