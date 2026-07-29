import type { FeatureCollection, Point } from 'geojson'
import type { Closure, RallyYear, Stage, StageCode, StageFeature } from './types'

export function stagesForDay(year: RallyYear, day: number): Stage[] {
  return year.stages.filter((s) => s.day === day).sort((a, b) => a.order - b.order)
}

export function stageByCode(year: RallyYear, code: StageCode): Stage | null {
  return year.stages.find((s) => s.code === code) ?? null
}

export function featureForStage(year: RallyYear, code: StageCode): StageFeature | null {
  const stage = stageByCode(year, code)
  if (!stage?.featureId) return null
  return year.features.features.find((f) => f.properties.featureId === stage.featureId) ?? null
}

export function closureForStage(year: RallyYear, code: StageCode): Closure | null {
  const stage = stageByCode(year, code)
  if (!stage) return null
  return year.closures.find((c) => c.id === stage.closureId) ?? null
}

export function stagesSharingFeature(year: RallyYear, featureId: string): Stage[] {
  return year.stages
    .filter((s) => s.featureId === featureId)
    .sort((a, b) => a.day - b.day || a.order - b.order)
}

export function closuresForDay(year: RallyYear, day: number): Closure[] {
  const ids = new Set(stagesForDay(year, day).map((s) => s.closureId))
  return year.closures
    .filter((c) => ids.has(c.id))
    .sort((a, b) => a.closesAt.localeCompare(b.closesAt) || a.id.localeCompare(b.id))
}

export function featuresForDay(year: RallyYear, day: number): StageFeature[] {
  const ids = new Set(
    stagesForDay(year, day)
      .map((s) => s.featureId)
      .filter((id): id is string => id !== null),
  )
  return year.features.features.filter((f) => ids.has(f.properties.featureId))
}

export interface TerminusProperties {
  featureId: string
  role: 'start' | 'finish'
  label: string
  address: string
}

// The KML gives two address pins per folder without saying which is which, so
// the role comes from whichever end of the run direction each pin sits closest to.
export function terminiFor(features: StageFeature[]): FeatureCollection<Point, TerminusProperties> {
  const gap = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])

  return {
    type: 'FeatureCollection',
    features: features.flatMap((feature) => {
      const coordinates = feature.geometry.coordinates
      const head = coordinates[0]
      const tail = coordinates[coordinates.length - 1]
      const pins = feature.properties.termini

      return pins.map((terminus, index) => {
        const role =
          pins.length === 2 && gap(terminus.coordinate, head) === gap(terminus.coordinate, tail)
            ? index === 0
              ? 'start'
              : 'finish'
            : gap(terminus.coordinate, head) <= gap(terminus.coordinate, tail)
              ? 'start'
              : 'finish'

        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: terminus.coordinate },
          properties: {
            featureId: feature.properties.featureId,
            role,
            label: role === 'start' ? 'Start' : 'Finish',
            address: terminus.name,
          },
        }
      })
    }),
  }
}

export type Bounds = [number, number, number, number]

export function boundsOf(features: StageFeature[]): Bounds | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const feature of features) {
    for (const [lon, lat] of feature.geometry.coordinates) {
      if (lon < west) west = lon
      if (lon > east) east = lon
      if (lat < south) south = lat
      if (lat > north) north = lat
    }
  }

  return Number.isFinite(west) ? [west, south, east, north] : null
}
