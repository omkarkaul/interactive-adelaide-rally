import { describe, expect, it } from 'vitest'
import type { Feature, LineString } from 'geojson'
import { cumulativeDistancesKm, cursorFromPoint, pointFromCursor } from './cursor'

const line = (coordinates: number[][]): Feature<LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates },
})

const straight = line([
  [138.7, -34.9],
  [138.71, -34.9],
  [138.72, -34.9],
])

// Out and back along two parallel legs about 22 m apart, as a hairpin reads.
const hairpin = line([
  [138.7, -34.9],
  [138.71, -34.9],
  [138.71, -34.8998],
  [138.7, -34.8998],
])

const legLengthKm = cumulativeDistancesKm(hairpin.geometry.coordinates)[1]
const totalKm = cumulativeDistancesKm(hairpin.geometry.coordinates).at(-1)!

describe('cursorFromPoint', () => {
  it('measures distance along the line, not straight-line distance', () => {
    const cursor = cursorFromPoint('SS4', straight, [138.71, -34.9])
    expect(cursor.code).toBe('SS4')
    expect(cursor.distanceKm).toBeCloseTo(cumulativeDistancesKm(straight.geometry.coordinates)[1], 4)
  })

  it('clamps to the ends of the line', () => {
    expect(cursorFromPoint('SS4', straight, [138.5, -34.9]).distanceKm).toBeCloseTo(0, 4)
    expect(cursorFromPoint('SS4', straight, [138.9, -34.9]).distanceKm).toBeCloseTo(
      cumulativeDistancesKm(straight.geometry.coordinates).at(-1)!,
      4,
    )
  })

  // Without the continuity bias the marker teleports between hairpin legs.
  it('breaks a tie towards where the cursor already was', () => {
    const equidistant: [number, number] = [138.705, -34.8999]

    const nearStart = cursorFromPoint('SS4', hairpin, equidistant, {
      code: 'SS4',
      distanceKm: 0.2,
    })
    expect(nearStart.distanceKm).toBeLessThan(legLengthKm)

    const nearEnd = cursorFromPoint('SS4', hairpin, equidistant, {
      code: 'SS4',
      distanceKm: totalKm - 0.2,
    })
    expect(nearEnd.distanceKm).toBeGreaterThan(totalKm - legLengthKm)
  })

  it('ignores a previous cursor belonging to another stage', () => {
    const equidistant: [number, number] = [138.705, -34.8999]
    const foreign = cursorFromPoint('SS4', hairpin, equidistant, {
      code: 'SS7',
      distanceKm: totalKm - 0.2,
    })
    const fresh = cursorFromPoint('SS4', hairpin, equidistant)
    expect(foreign.distanceKm).toBeCloseTo(fresh.distanceKm, 6)
  })

  it('still takes the clearly nearer leg despite a distant previous cursor', () => {
    const onFirstLeg: [number, number] = [138.705, -34.90005]
    const cursor = cursorFromPoint('SS4', hairpin, onFirstLeg, {
      code: 'SS4',
      distanceKm: totalKm - 0.1,
    })
    expect(cursor.distanceKm).toBeLessThan(legLengthKm)
  })
})

describe('pointFromCursor', () => {
  it('round-trips a point on the line', () => {
    const original: [number, number] = [138.713, -34.9]
    const cursor = cursorFromPoint('SS4', straight, original)
    const [lon, lat] = pointFromCursor(straight, cursor)
    expect(lon).toBeCloseTo(original[0], 4)
    expect(lat).toBeCloseTo(original[1], 4)
  })
})
