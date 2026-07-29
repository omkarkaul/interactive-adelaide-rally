import { distance } from '@turf/distance'
import { length } from '@turf/length'
import type { Feature, LineString } from 'geojson'
import type { Profile, ProfileSample } from './types'

const SMOOTHING_WINDOW_M = 200

export function hasElevation(line: Feature<LineString>): boolean {
  return line.geometry.coordinates.some((c) => c.length > 2 && Number.isFinite(c[2]))
}

function cumulativeKm(coordinates: number[][]): number[] {
  const out = [0]
  for (let i = 1; i < coordinates.length; i++) {
    out.push(out[i - 1] + distance(coordinates[i - 1], coordinates[i], { units: 'kilometers' }))
  }
  return out
}

// Terrarium/OpenTopoData samples are noisy enough that raw vertex-to-vertex
// gradients read as absurd. Averaging elevation over a fixed ground distance
// keeps the profile shape while making the grade legible.
function smooth(distancesKm: number[], elevations: number[], windowM: number): number[] {
  const halfKm = windowM / 2000
  return elevations.map((_, i) => {
    let sum = 0
    let count = 0
    for (let j = i; j >= 0 && distancesKm[i] - distancesKm[j] <= halfKm; j--) {
      sum += elevations[j]
      count++
    }
    for (let j = i + 1; j < elevations.length && distancesKm[j] - distancesKm[i] <= halfKm; j++) {
      sum += elevations[j]
      count++
    }
    return sum / count
  })
}

export function buildProfile(
  line: Feature<LineString>,
  lengthKm: number = length(line, { units: 'kilometers' }),
): Profile | null {
  const coordinates = line.geometry.coordinates
  if (coordinates.length < 2 || !hasElevation(line)) return null

  const distances = cumulativeKm(coordinates)
  const raw = coordinates.map((c) => (Number.isFinite(c[2]) ? c[2] : Number.NaN))
  if (raw.some(Number.isNaN)) return null

  const elevations = smooth(distances, raw, SMOOTHING_WINDOW_M)

  const samples: ProfileSample[] = elevations.map((elevationM, i) => {
    const prev = Math.max(0, i - 1)
    const next = Math.min(elevations.length - 1, i + 1)
    const runM = (distances[next] - distances[prev]) * 1000
    const riseM = elevations[next] - elevations[prev]
    return {
      distanceKm: distances[i],
      elevationM,
      gradePct: runM > 0 ? (riseM / runM) * 100 : 0,
    }
  })

  let climbM = 0
  let descentM = 0
  for (let i = 1; i < elevations.length; i++) {
    const delta = elevations[i] - elevations[i - 1]
    if (delta > 0) climbM += delta
    else descentM -= delta
  }

  return {
    samples,
    lengthKm,
    climbM,
    descentM,
    maxGradePct: samples.reduce((max, s) => Math.max(max, Math.abs(s.gradePct)), 0),
    netM: elevations[elevations.length - 1] - elevations[0],
  }
}

export function sampleAtDistance(profile: Profile, distanceKm: number): ProfileSample {
  const samples = profile.samples
  let low = 0
  let high = samples.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (samples[mid].distanceKm < distanceKm) low = mid + 1
    else high = mid
  }
  const after = samples[low]
  const before = samples[Math.max(0, low - 1)]
  return Math.abs(before.distanceKm - distanceKm) <= Math.abs(after.distanceKm - distanceKm)
    ? before
    : after
}
