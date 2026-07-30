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
    expect(usesFeatureState(lineLayer(1).paint?.['line-width'], 'focused')).toBe(true)
    expect(usesFeatureState(lineLayer(1).paint?.['line-opacity'], 'focused')).toBe(true)
    expect(usesFeatureState(lineLayer(1).paint?.['line-opacity'], 'dimmed')).toBe(true)
    expect(usesFeatureState(casingLayer(1).paint?.['line-opacity'], 'dimmed')).toBe(true)
    expect(usesFeatureState(terminiLayer(1).paint?.['circle-opacity'], 'dimmed')).toBe(true)
    expect(usesFeatureState(terminiLabelLayer(1).paint?.['text-opacity'], 'dimmed')).toBe(true)
  })

  it('colours the line by closure state, and by nothing else', () => {
    const color = JSON.stringify(lineLayer(1).paint?.['line-color'])
    for (const value of [COLOR.pending, COLOR.closed, COLOR.reopened]) {
      expect(color).toContain(value)
    }
    expect(usesFeatureState(lineLayer(1).paint?.['line-color'], 'closureState')).toBe(true)
  })

  // Hue is closure state. A focused line gets wider and more opaque; it must not
  // change colour, or focus and state become impossible to read apart.
  it('never expresses focus as a colour', () => {
    expect(usesFeatureState(lineLayer(1).paint?.['line-color'], 'focused')).toBe(false)
    expect(usesFeatureState(lineLayer(1).paint?.['line-color'], 'dimmed')).toBe(false)
  })

  // MapLibre only accepts ['zoom'] as the direct input of a top-level interpolate
  // or step. Nested inside another operator it rejects the paint value and the
  // layer draws nothing — silently, which is how the route lines vanished once.
  it('keeps every zoom interpolation at the top of its paint property', () => {
    const countZoom = (node: unknown): number =>
      Array.isArray(node)
        ? (node[0] === 'zoom' ? 1 : 0) + node.reduce((n, child) => n + countZoom(child), 0)
        : 0

    const zoomIsTopLevelInput = (value: unknown) => {
      if (!Array.isArray(value)) return false
      const input = value[0] === 'interpolate' ? value[2] : value[0] === 'step' ? value[1] : null
      return Array.isArray(input) && input[0] === 'zoom'
    }

    for (const layer of [casingLayer(1), lineLayer(1), hitLayer(1), terminiLayer(1)]) {
      for (const [property, value] of Object.entries(layer.paint ?? {})) {
        const where = `${layer.id}.${property}`
        const uses = countZoom(value)
        expect([where, uses]).toEqual([where, uses > 0 ? 1 : 0])
        if (uses === 1) expect([where, zoomIsTopLevelInput(value)]).toEqual([where, true])
      }
    }
  })

  it('puts a wide invisible band under each line for pointer targeting', () => {
    const hit = hitLayer(1)
    expect(hit.id).toBe(hitLayerId(1))
    expect(hit.paint?.['line-width']).toBe(20)
    expect(hit.paint?.['line-opacity']).toBe(0)
  })

  it('draws termini from their own source, filled or hollow by role', () => {
    expect(terminiLayer(1).source).toBe(terminiSourceId(1))
    const fill = JSON.stringify(terminiLayer(1).paint?.['circle-color'])
    expect(fill).toContain(COLOR.label)
    expect(fill).toContain(COLOR.casing)
    expect(terminiLabelLayer(1).layout?.['text-field']).toEqual(['get', 'label'])
  })
})
