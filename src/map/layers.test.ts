import { describe, expect, it } from 'vitest'
import {
  casingLayer,
  COLOR,
  hitLayer,
  hitLayerId,
  layerIdsForDay,
  lineLayer,
  sourceId,
  terminiLabelLayer,
  terminiLayer,
  terminiSourceId,
} from './layers'

const usesFeatureState = (value: unknown, key: string) =>
  JSON.stringify(value).includes(`["feature-state","${key}"]`)

describe('layers', () => {
  it('keeps every day on its own source and layer ids', () => {
    expect(sourceId(1)).not.toBe(sourceId(2))
    expect(new Set(layerIdsForDay(1)).size).toBe(5)
    expect(layerIdsForDay(1).some((id) => layerIdsForDay(2).includes(id))).toBe(false)
  })

  it('draws a casing beneath the line, both from the stage source', () => {
    expect(casingLayer(1).source).toBe(sourceId(1))
    expect(lineLayer(1).source).toBe(sourceId(1))
    expect(layerIdsForDay(1).indexOf(casingLayer(1).id)).toBeLessThan(
      layerIdsForDay(1).indexOf(lineLayer(1).id),
    )
  })

  // Focus must be a paint-time state change, never a layer swap.
  it('reads focus and dimming from feature-state rather than properties', () => {
    expect(usesFeatureState(lineLayer(1).paint?.['line-color'], 'focused')).toBe(true)
    expect(usesFeatureState(lineLayer(1).paint?.['line-width'], 'focused')).toBe(true)
    expect(usesFeatureState(lineLayer(1).paint?.['line-opacity'], 'dimmed')).toBe(true)
    expect(usesFeatureState(casingLayer(1).paint?.['line-opacity'], 'dimmed')).toBe(true)
    expect(usesFeatureState(terminiLayer(1).paint?.['circle-opacity'], 'dimmed')).toBe(true)
    expect(usesFeatureState(terminiLabelLayer(1).paint?.['text-opacity'], 'dimmed')).toBe(true)
  })

  it('restyles the line when its closure is closed', () => {
    const color = JSON.stringify(lineLayer(1).paint?.['line-color'])
    expect(color).toContain('"closed"')
    expect(color).toContain(COLOR.closed)
  })

  it('puts a wide invisible band under each line for pointer targeting', () => {
    const hit = hitLayer(1)
    expect(hit.id).toBe(hitLayerId(1))
    expect(hit.paint?.['line-width']).toBe(20)
    expect(hit.paint?.['line-opacity']).toBe(0)
  })

  it('draws termini from their own source, coloured by role', () => {
    expect(terminiLayer(1).source).toBe(terminiSourceId(1))
    expect(JSON.stringify(terminiLayer(1).paint?.['circle-color'])).toContain(COLOR.start)
    expect(terminiLabelLayer(1).layout?.['text-field']).toEqual(['get', 'label'])
  })
})
