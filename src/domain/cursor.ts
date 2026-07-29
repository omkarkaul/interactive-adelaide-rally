import { along } from '@turf/along'
import { distance } from '@turf/distance'
import type { Feature, LineString, Position } from 'geojson'
import type { Cursor, StageCode } from './types'

const KM_PER_DEGREE = 111.32

interface Candidate {
  alongKm: number
  offsetKm: number
}

function projector(coordinates: Position[]) {
  const meanLat =
    coordinates.reduce((sum, c) => sum + c[1], 0) / Math.max(1, coordinates.length)
  const lonScale = Math.cos((meanLat * Math.PI) / 180) * KM_PER_DEGREE
  return ([lon, lat]: Position): [number, number] => [lon * lonScale, lat * KM_PER_DEGREE]
}

export function cumulativeDistancesKm(coordinates: Position[]): number[] {
  const out = [0]
  for (let i = 1; i < coordinates.length; i++) {
    out.push(out[i - 1] + distance(coordinates[i - 1], coordinates[i], { units: 'kilometers' }))
  }
  return out
}

function candidates(coordinates: Position[], point: Position): Candidate[] {
  const project = projector(coordinates)
  const cumulative = cumulativeDistancesKm(coordinates)
  const p = project(point)
  const out: Candidate[] = []

  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = project(coordinates[i])
    const b = project(coordinates[i + 1])
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq))
    const cx = a[0] + t * dx
    const cy = a[1] + t * dy
    out.push({
      alongKm: cumulative[i] + t * (cumulative[i + 1] - cumulative[i]),
      offsetKm: Math.hypot(p[0] - cx, p[1] - cy),
    })
  }

  return out
}

// Switchbacks put several legs of the same road within metres of the pointer.
// Taking the global nearest makes the marker teleport between hairpin legs, so
// any candidate within this band of the nearest is treated as a tie and broken
// by proximity to where the cursor already was.
const TIE_RATIO = 1.5
const TIE_FLOOR_KM = 0.005

export function cursorFromPoint(
  code: StageCode,
  line: Feature<LineString>,
  point: Position,
  previous?: Cursor | null,
): Cursor {
  const coordinates = line.geometry.coordinates
  if (coordinates.length < 2) return { code, distanceKm: 0 }

  const all = candidates(coordinates, point)
  const nearest = all.reduce((min, c) => Math.min(min, c.offsetKm), Infinity)
  const band = Math.max(nearest * TIE_RATIO, nearest + TIE_FLOOR_KM)
  const tied = all.filter((c) => c.offsetKm <= band)

  if (!previous || previous.code !== code || tied.length === 1) {
    const best = tied.reduce((a, b) => (a.offsetKm <= b.offsetKm ? a : b))
    return { code, distanceKm: best.alongKm }
  }

  const best = tied.reduce((a, b) =>
    Math.abs(a.alongKm - previous.distanceKm) <= Math.abs(b.alongKm - previous.distanceKm) ? a : b,
  )
  return { code, distanceKm: best.alongKm }
}

export function pointFromCursor(line: Feature<LineString>, cursor: Cursor): Position {
  return along(line, cursor.distanceKm, { units: 'kilometers' }).geometry.coordinates
}
