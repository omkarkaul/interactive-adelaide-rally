import { closureForStage, featureForStage, stageByCode } from './link'
import { buildProfile } from './profile'
import type { RallyYear, StageCode, StageDetail } from './types'

export function officialMapUrl(mid: string | undefined): string | null {
  return mid ? `https://www.google.com/maps/d/viewer?mid=${mid}` : null
}

// A stage with featureId: null has no line to render, so it has no detail view;
// the day panel falls back to a list-only card.
export function resolveStageDetail(year: RallyYear, code: StageCode): StageDetail | null {
  const stage = stageByCode(year, code)
  if (!stage) return null

  const line = featureForStage(year, code)
  const closure = closureForStage(year, code)
  if (!line || !closure) return null

  return {
    code,
    runsAs: [...closure.stageCodes],
    name: stage.name,
    day: stage.day,
    line,
    closure,
    profile: buildProfile(line),
    spectator: year.spectators[code] ?? null,
    officialMapUrl: officialMapUrl(line.properties.sourceMid),
  }
}
