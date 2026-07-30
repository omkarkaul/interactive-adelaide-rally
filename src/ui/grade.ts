import type { Profile } from '../domain/types'
import { token } from '../tokens'

// One diverging ramp shared by the plan view and the profile, so the two read as
// the same object before the user interacts with either. Blue descends, red climbs.
const STOPS: [number, string][] = [
  [-15, token('--g-dn2')],
  [-8, token('--g-dn')],
  [0, token('--g-flat')],
  [8, token('--g-up')],
  [15, token('--g-up2')],
]

const hex = (value: string) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
]

export function gradeColor(gradePct: number): string {
  const g = Math.max(STOPS[0][0], Math.min(STOPS[STOPS.length - 1][0], gradePct))

  for (let i = 1; i < STOPS.length; i++) {
    if (g > STOPS[i][0]) continue
    const [lowG, lowHex] = STOPS[i - 1]
    const [highG, highHex] = STOPS[i]
    const t = highG === lowG ? 0 : (g - lowG) / (highG - lowG)
    const low = hex(lowHex)
    const high = hex(highHex)
    const channel = (n: number) => Math.round(low[n] + (high[n] - low[n]) * t)
    return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`
  }

  return STOPS[STOPS.length - 1][1]
}

// MapLibre line-gradient interpolates over line-progress, so the profile's grade
// series has to be expressed as fractions of the line's length.
export function gradeGradientExpression(profile: Profile): unknown[] {
  const expression: unknown[] = ['interpolate', ['linear'], ['line-progress']]
  const total = profile.lengthKm || 1
  const step = Math.max(1, Math.ceil(profile.samples.length / 120))

  let previous = -1
  for (let i = 0; i < profile.samples.length; i += step) {
    const sample = profile.samples[i]
    const progress = Math.min(1, Math.max(0, sample.distanceKm / total))
    if (progress <= previous) continue
    previous = progress
    expression.push(progress, gradeColor(sample.gradePct))
  }

  if (previous < 1) expression.push(1, gradeColor(profile.samples[profile.samples.length - 1].gradePct))
  return expression
}

export const GRADE_LEGEND = [-12, -6, 0, 6, 12]
