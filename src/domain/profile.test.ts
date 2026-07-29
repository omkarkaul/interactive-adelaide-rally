import { describe, expect, it } from 'vitest'
import type { Feature, LineString } from 'geojson'
import { buildProfile, hasElevation, sampleAtDistance } from './profile'

const line = (coordinates: number[][]): Feature<LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates },
})

// Roughly 1.1 km per 0.01 degrees of longitude at this latitude.
const climbing = line([
  [138.7, -34.9, 100],
  [138.71, -34.9, 150],
  [138.72, -34.9, 130],
  [138.73, -34.9, 180],
])

describe('hasElevation', () => {
  it('is false for a two-dimensional line', () => {
    expect(hasElevation(line([[138.7, -34.9], [138.71, -34.9]]))).toBe(false)
    expect(hasElevation(climbing)).toBe(true)
  })
})

describe('buildProfile', () => {
  it('returns null without z values, so the section can be omitted', () => {
    expect(buildProfile(line([[138.7, -34.9], [138.71, -34.9]]))).toBeNull()
  })

  it('returns null for a degenerate line', () => {
    expect(buildProfile(line([[138.7, -34.9, 100]]))).toBeNull()
  })

  it('emits one sample per vertex with monotonic distance', () => {
    const profile = buildProfile(climbing)!
    expect(profile.samples).toHaveLength(4)
    expect(profile.samples[0].distanceKm).toBe(0)
    for (let i = 1; i < profile.samples.length; i++) {
      expect(profile.samples[i].distanceKm).toBeGreaterThan(profile.samples[i - 1].distanceKm)
    }
    expect(profile.lengthKm).toBeCloseTo(profile.samples.at(-1)!.distanceKm, 3)
  })

  it('reports net gain as end minus start', () => {
    const profile = buildProfile(climbing)!
    expect(profile.netM).toBeCloseTo(
      profile.samples.at(-1)!.elevationM - profile.samples[0].elevationM,
      6,
    )
    expect(profile.climbM - profile.descentM).toBeCloseTo(profile.netM, 6)
  })

  it('smooths a single-vertex spike rather than reporting its raw gradient', () => {
    const spiky = line([
      [138.7, -34.9, 100],
      [138.7001, -34.9, 100],
      [138.7002, -34.9, 160],
      [138.7003, -34.9, 100],
      [138.7004, -34.9, 100],
    ])
    const profile = buildProfile(spiky)!
    const peak = Math.max(...profile.samples.map((s) => s.elevationM))
    expect(peak).toBeLessThan(160)
    expect(profile.maxGradePct).toBeLessThan(300)
  })

  it('accepts a caller-supplied length', () => {
    expect(buildProfile(climbing, 42)!.lengthKm).toBe(42)
  })
})

describe('sampleAtDistance', () => {
  const profile = buildProfile(climbing)!

  it('returns the nearest sample at the ends and in the middle', () => {
    expect(sampleAtDistance(profile, -5)).toBe(profile.samples[0])
    expect(sampleAtDistance(profile, 1e6)).toBe(profile.samples.at(-1))
    const mid = profile.samples[2]
    expect(sampleAtDistance(profile, mid.distanceKm)).toBe(mid)
  })
})
