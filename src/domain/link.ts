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
