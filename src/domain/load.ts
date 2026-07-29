import { eventLoader, geometryLoaders, sourcesLoader } from './registry'
import type {
  Closure,
  RallyEvent,
  RallyYear,
  SourceRecord,
  SpectatorInfo,
  Stage,
  StageCode,
  StageFeature,
  StageFeatureCollection,
} from './types'

interface EventFile {
  event: RallyEvent
  stages: Stage[]
  closures: Closure[]
  spectators?: Record<StageCode, SpectatorInfo>
}

interface SourcesFile {
  sources: SourceRecord[]
}

class DatasetError extends Error {}

function require(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DatasetError(message)
}

export function validateYear(year: RallyYear): RallyYear {
  const { event, stages, closures, features } = year

  require(event && Number.isInteger(event.year), 'event.year missing')
  require(Array.isArray(event.days) && event.days.length > 0, 'event.days empty')
  require(Array.isArray(stages) && stages.length > 0, 'stages empty')
  require(Array.isArray(closures) && closures.length > 0, 'closures empty')
  require(features?.type === 'FeatureCollection', 'features is not a FeatureCollection')

  const dayNumbers = new Set(event.days.map((d) => d.dayNumber))
  const closureIds = new Set(closures.map((c) => c.id))
  const featureIds = new Set(features.features.map((f) => f.properties.featureId))
  const seenCodes = new Set<StageCode>()

  for (const stage of stages) {
    require(stage.code, 'stage without a code')
    require(!seenCodes.has(stage.code), `duplicate stage code ${stage.code}`)
    seenCodes.add(stage.code)
    require(dayNumbers.has(stage.day), `${stage.code}: unknown day ${stage.day}`)
    require(closureIds.has(stage.closureId), `${stage.code}: unknown closure ${stage.closureId}`)
    require(
      stage.featureId === null || featureIds.has(stage.featureId),
      `${stage.code}: unknown feature ${stage.featureId}`,
    )
  }

  for (const closure of closures) {
    require(closure.stageCodes.length > 0, `${closure.id}: no stage codes`)
    for (const code of closure.stageCodes) {
      require(seenCodes.has(code), `${closure.id}: references unknown stage ${code}`)
    }
  }

  for (const feature of features.features) {
    require(
      feature.geometry?.type === 'LineString' && feature.geometry.coordinates.length > 1,
      `${feature.properties.featureId}: not a usable LineString`,
    )
  }

  return year
}

export async function loadYear(year: number): Promise<RallyYear> {
  const [eventFile, sourcesFile, geometryTexts] = await Promise.all([
    eventLoader(year)() as Promise<EventFile>,
    sourcesLoader(year)() as Promise<SourcesFile>,
    Promise.all(geometryLoaders(year).map((load) => load())),
  ])

  const collections = geometryTexts.map((text) => JSON.parse(text) as StageFeatureCollection)
  const features: StageFeatureCollection = {
    type: 'FeatureCollection',
    features: collections.flatMap((c) => c.features as StageFeature[]),
  }

  return validateYear({
    event: eventFile.event,
    stages: eventFile.stages,
    closures: eventFile.closures,
    features,
    sources: sourcesFile.sources,
    spectators: eventFile.spectators ?? {},
  })
}
