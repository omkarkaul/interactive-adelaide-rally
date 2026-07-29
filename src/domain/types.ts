import type { Feature, FeatureCollection, LineString } from 'geojson'

export type StageCode = string

export interface RallyEvent {
  year: number
  name: string
  days: RallyDay[]
}

export interface RallyDay {
  dayNumber: number
  date: string
  label: string
}

export interface Stage {
  code: StageCode
  name: string
  day: number
  order: number
  spectator: boolean
  featureId: string | null
  closureId: string
}

export interface Closure {
  id: string
  stageCodes: StageCode[]
  roadsClosed: string[]
  start: string
  finish: string
  intersections: string[]
  closesAt: string
  reopensAt: string
  confirmed: boolean
  notes: string[]
}

export interface SourceRecord {
  mid: string
  url: string
  fetchedAt: string
  sha256: string
  documentName: string
}

export interface StageTerminus {
  name: string
  coordinate: [number, number]
}

export interface StageFeatureProperties {
  featureId: string
  stageCodes: StageCode[]
  name: string
  day: number
  sourceMid: string
  termini: StageTerminus[]
}

export type StageFeature = Feature<LineString, StageFeatureProperties>
export type StageFeatureCollection = FeatureCollection<LineString, StageFeatureProperties>

export interface RallyYear {
  event: RallyEvent
  stages: Stage[]
  closures: Closure[]
  features: StageFeatureCollection
  sources: SourceRecord[]
  spectators: Record<StageCode, SpectatorInfo>
}

export interface ProfileSample {
  distanceKm: number
  elevationM: number
  gradePct: number
}

export interface Profile {
  samples: ProfileSample[]
  lengthKm: number
  climbM: number
  descentM: number
  maxGradePct: number
  netM: number
}

export interface SpectatorInfo {
  name: string
  url: string
  description: string
}

export interface StageDetail {
  code: StageCode
  runsAs: StageCode[]
  name: string
  day: number
  line: StageFeature
  closure: Closure
  profile: Profile | null
  spectator: SpectatorInfo | null
  officialMapUrl: string | null
}

export type Focus =
  | { kind: 'none' }
  | { kind: 'hover'; code: StageCode }
  | { kind: 'selected'; code: StageCode }

export interface Cursor {
  code: StageCode
  distanceKm: number
}
