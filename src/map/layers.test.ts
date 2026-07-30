import { describe, expect, it } from 'vitest'
import {
  casingLayer,
  reopenedDashLayer,
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
    // Unique within a day and disjoint between days. A count here just breaks
    // every time a layer is added, without testing anything.
    expect(new Set(layerIdsForDay(1)).size).toBe(layerIdsForDay(1).length)
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
    // Focus widens the line; everything else drops to 0.20. Both directions are
    // feature-state, neither is a colour.
    expect(usesFeatureState(lineLayer(1).paint?.['line-width'], 'focused')).toBe(true)
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

  // Pending and reopened are only 1.23:1 apart in luminance, because no pair of
  // greys that clears the basemap contrast floor can be further apart. The dash is
  // what actually separates them, so it is not decoration.
  it('dashes the reopened line, and only the reopened line', () => {
    const paint = reopenedDashLayer(1).paint!
    expect(paint['line-dasharray']).toEqual([1.4, 1.4])
    expect(paint['line-color']).toBe(COLOR.casing)

    const opacity = JSON.stringify(paint['line-opacity'])
    expect(opacity).toContain('reopened')
    expect(usesFeatureState(paint['line-opacity'], 'closureState')).toBe(true)
  })

  it('ranks the states by weight, since it cannot rank them by brightness', () => {
    const widths = JSON.stringify(lineLayer(1).paint?.['line-width'])
    // At zoom 12 the scale factor is 1, so the spec values appear verbatim.
    expect(widths).toContain('6')
    expect(widths).toContain('4')
    expect(widths).toContain('3')
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
    expect(fill).toContain(COLOR.terminus)
    expect(fill).toContain(COLOR.casing)
    // Termini must not out-brighten the route layer they annotate.
    expect(COLOR.terminus).not.toBe(COLOR.label)
    expect(terminiLabelLayer(1).layout?.['text-field']).toEqual(['get', 'label'])
  })
})
