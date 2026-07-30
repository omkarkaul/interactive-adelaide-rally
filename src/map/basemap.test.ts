import { describe, expect, it } from 'vitest'
import { ADELAIDE_HILLS_CENTER, BASEMAP_STYLE_URL, DEFAULT_ZOOM } from './basemap'

describe('basemap', () => {
  // Dark chrome needs a dark basemap; a white slab inside it was the second most
  // visible defect in the first build.
  it('points at a keyless dark OpenFreeMap style', () => {
    expect(BASEMAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/dark')
    expect(BASEMAP_STYLE_URL).not.toMatch(/key=|token=/)
  })

  it('centres on the Adelaide Hills', () => {
    const [lon, lat] = ADELAIDE_HILLS_CENTER
    expect(lon).toBeCloseTo(138.75, 2)
    expect(lat).toBeCloseTo(-34.93, 2)
    expect(DEFAULT_ZOOM).toBe(10)
  })
})
