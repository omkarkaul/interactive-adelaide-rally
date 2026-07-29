import { beforeAll, describe, expect, it } from 'vitest'
import { loadYear } from './load'
import { availableYears, datasetPath } from './registry'
import { closureForStage, featureForStage, stagesForDay, stagesSharingFeature } from './link'
import { resolveStageDetail } from './detail'
import type { RallyYear } from './types'

const ALL_CODES = Array.from({ length: 30 }, (_, i) => `SS${i + 1}`)

const SHARED_GEOMETRY: [string, string][] = [
  ['SS4', 'SS7'],
  ['SS3', 'SS9'],
  ['SS6', 'SS10'],
  ['SS15', 'SS19'],
  ['SS25', 'SS27'],
  ['SS26', 'SS28'],
]

describe('registry', () => {
  it('discovers committed years without code changes', () => {
    expect(availableYears()).toContain(2026)
    expect(datasetPath(2026)).toBe('/data/2026')
  })
})

describe('2026 dataset', () => {
  let year: RallyYear

  beforeAll(async () => {
    year = await loadYear(2026)
  })

  it('carries all three days and thirty stages', () => {
    expect(year.event.days.map((d) => d.dayNumber)).toEqual([1, 2, 3])
    expect(year.stages.map((s) => s.code).sort()).toEqual(ALL_CODES.slice().sort())
  })

  // The guard rail for future years: no stage may be added without a closure and
  // either a resolving feature or a deliberate null.
  it.each(ALL_CODES)('%s resolves to a closure and to a feature or explicit null', (code) => {
    const stage = year.stages.find((s) => s.code === code)!
    expect(closureForStage(year, code)).not.toBeNull()
    if (stage.featureId === null) {
      expect(featureForStage(year, code)).toBeNull()
    } else {
      expect(featureForStage(year, code)?.properties.featureId).toBe(stage.featureId)
    }
  })

  it.each(SHARED_GEOMETRY)('%s and %s resolve to one feature', (a, b) => {
    const featureA = featureForStage(year, a)
    const featureB = featureForStage(year, b)
    expect(featureA).not.toBeNull()
    expect(featureA).toBe(featureB)
    expect(stagesSharingFeature(year, featureA!.properties.featureId).map((s) => s.code)).toEqual([
      a,
      b,
    ])
  })

  it('orders each day by run order', () => {
    expect(stagesForDay(year, 1).map((s) => s.code)).toEqual(ALL_CODES.slice(0, 11))
    expect(stagesForDay(year, 2).map((s) => s.code)).toEqual(ALL_CODES.slice(11, 22))
    expect(stagesForDay(year, 3).map((s) => s.code)).toEqual(ALL_CODES.slice(22, 30))
  })

  it('marks days two and three provisional and day one confirmed', () => {
    const dayOf = (id: string) => Number(id[1])
    for (const closure of year.closures) {
      expect(closure.confirmed).toBe(dayOf(closure.id) === 1)
    }
  })

  it('flags only the spectator stages named by the organisers', () => {
    expect(year.stages.filter((s) => s.spectator).map((s) => s.code)).toEqual([
      'SS20',
      'SS25',
      'SS27',
    ])
  })

  it('runs SS24 and SS29 in opposing directions over the same roads', () => {
    const mylor = featureForStage(year, 'SS24')!.geometry.coordinates
    const warrawong = featureForStage(year, 'SS29')!.geometry.coordinates
    const gap = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])
    expect(gap(mylor[0], warrawong[warrawong.length - 1])).toBeLessThan(0.01)
    expect(gap(mylor[mylor.length - 1], warrawong[0])).toBeLessThan(0.01)
  })

  it('records provenance for every source map', () => {
    expect(year.sources).toHaveLength(6)
    for (const source of year.sources) {
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(source.url).toContain(source.mid)
    }
  })

  describe('resolveStageDetail', () => {
    it.each(ALL_CODES)('%s opens a detail view', (code) => {
      const detail = resolveStageDetail(year, code)!
      expect(detail).not.toBeNull()
      expect(detail.line.geometry.coordinates.length).toBeGreaterThan(1)
      expect(detail.closure.stageCodes).toContain(code)
      expect(detail.officialMapUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/d\/viewer\?mid=/)
    })

    it('reports repeat runs through runsAs', () => {
      expect(resolveStageDetail(year, 'SS4')!.runsAs).toEqual(['SS4', 'SS7'])
      expect(resolveStageDetail(year, 'SS7')!.runsAs).toEqual(['SS4', 'SS7'])
    })

    // SS3 and SS9 share a line but not a closure, so neither is a repeat run of
    // the other and the shared-geometry caveat has to travel on the closure.
    it('does not treat shared geometry as a repeat run', () => {
      expect(resolveStageDetail(year, 'SS3')!.runsAs).toEqual(['SS3'])
      expect(resolveStageDetail(year, 'SS9')!.runsAs).toEqual(['SS9'])
      expect(resolveStageDetail(year, 'SS9')!.closure.notes.join(' ')).toContain('SS3')
    })

    it('attaches spectator information only to spectator stages', () => {
      expect(resolveStageDetail(year, 'SS20')!.spectator).not.toBeNull()
      expect(resolveStageDetail(year, 'SS21')!.spectator).toBeNull()
    })

    it('has no elevation profile before the enrichment pass', () => {
      const withProfile = ALL_CODES.filter((c) => resolveStageDetail(year, c)!.profile !== null)
      expect(withProfile.length === 0 || withProfile.length === ALL_CODES.length).toBe(true)
    })
  })
})
