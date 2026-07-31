import { describe, expect, it } from 'vitest'
import type { Feature, LineString } from 'geojson'
import { cumulativeDistancesKm, cursorFromPoint, pointFromCursor } from './cursor'
import dayOneRaw from '../../data/2026/geometry/day-1.geojson?raw'

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
  // turf's along walks off the coordinate array past the end of the line, which
  // the End key and a drag past the right edge of the profile both reach.
  it('clamps to the terminal coordinates rather than running off the line', () => {
    const coordinates = straight.geometry.coordinates
    const total = cumulativeDistancesKm(coordinates).at(-1)!

    expect(pointFromCursor(straight, { code: 'SS4', distanceKm: total })).toEqual(coordinates.at(-1))
    expect(pointFromCursor(straight, { code: 'SS4', distanceKm: total + 5 })).toEqual(
      coordinates.at(-1),
    )
    expect(pointFromCursor(straight, { code: 'SS4', distanceKm: 0 })).toEqual(coordinates[0])
    expect(pointFromCursor(straight, { code: 'SS4', distanceKm: -1 })).toEqual(coordinates[0])
    expect(pointFromCursor(straight, { code: 'SS4', distanceKm: Number.NaN })).toEqual(
      coordinates[0],
    )
  })

  it('round-trips a point on the line', () => {
    const original: [number, number] = [138.713, -34.9]
    const cursor = cursorFromPoint('SS4', straight, original)
    const [lon, lat] = pointFromCursor(straight, cursor)
    expect(lon).toBeCloseTo(original[0], 4)
    expect(lat).toBeCloseTo(original[1], 4)
  })
})

// The synthetic hairpin above is a fair model, but the Corkscrew is the road that
// motivated the continuity bias: a dozen switchbacks where the opposing leg is
// closer to the pointer than the leg the cursor is already on.
describe('the Corkscrew, from the real geometry', () => {
  const collection = JSON.parse(dayOneRaw) as {
    features: Feature<LineString, { featureId: string }>[]
  }
  const corkscrew = collection.features.find((f) => f.properties.featureId === 'cherryville-plus')!

  it('is the stage with the hairpins, and carries elevation', () => {
    expect(corkscrew).toBeDefined()
    expect(corkscrew.geometry.coordinates.length).toBeGreaterThan(100)
  })

  it('never runs backwards while the pointer walks the line', () => {
    const coordinates = corkscrew.geometry.coordinates
    let cursor = cursorFromPoint('SS4', corkscrew, coordinates[0] as [number, number])
    let regressions = 0

    for (const coordinate of coordinates.slice(1)) {
      const next = cursorFromPoint('SS4', corkscrew, coordinate as [number, number], cursor)
      if (next.distanceKm < cursor.distanceKm - 0.02) regressions++
      cursor = next
    }

    expect(regressions).toBe(0)
  })

  // Without the bias the marker jumps to whichever leg is marginally nearer, which
  // on a switchback is the one the driver has not reached yet.
  it('stays on the leg it is already on when both are within reach', () => {
    const coordinates = cumulativeDistancesKm(corkscrew.geometry.coordinates)
    const total = coordinates.at(-1)!
    const midway = { code: 'SS4' as const, distanceKm: total / 2 }
    const point = pointFromCursor(corkscrew, midway) as [number, number]

    const held = cursorFromPoint('SS4', corkscrew, point, midway)
    expect(held.distanceKm).toBeCloseTo(midway.distanceKm, 2)
  })
})
