import { describe, expect, it } from 'vitest'
import { gradeColor, gradeGradientExpression } from './grade'
import { buildProfile } from '../domain/profile'
import type { Feature, LineString } from 'geojson'

const rgb = (color: string) => color.match(/\d+/g)!.map(Number)

describe('gradeColor', () => {
  it('is neutral on the flat and diverges either side', () => {
    const [fr, fg, fb] = rgb(gradeColor(0))
    expect(Math.max(fr, fg, fb) - Math.min(fr, fg, fb)).toBeLessThan(30)

    expect(rgb(gradeColor(12))[0]).toBeGreaterThan(rgb(gradeColor(12))[2])
    expect(rgb(gradeColor(-12))[2]).toBeGreaterThan(rgb(gradeColor(-12))[0])
  })

  it('clamps beyond the ends of the ramp', () => {
    expect(gradeColor(200)).toBe(gradeColor(15))
    expect(gradeColor(-200)).toBe(gradeColor(-15))
  })

  it('is continuous across the ramp', () => {
    for (let g = -15; g < 15; g += 0.5) {
      const a = rgb(gradeColor(g))
      const b = rgb(gradeColor(g + 0.5))
      const jump = Math.max(...a.map((c, i) => Math.abs(c - b[i])))
      expect(jump).toBeLessThan(40)
    }
  })
})

describe('gradeGradientExpression', () => {
  const line: Feature<LineString> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: Array.from({ length: 200 }, (_, i) => [138.7 + i * 0.0005, -34.9, 100 + i]),
    },
  }

  it('interpolates over line-progress in strictly increasing stops', () => {
    const expression = gradeGradientExpression(buildProfile(line)!)
    expect(expression.slice(0, 3)).toEqual(['interpolate', ['linear'], ['line-progress']])

    const stops = expression.slice(3)
    const positions = stops.filter((_, i) => i % 2 === 0) as number[]
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
    expect(positions[0]).toBe(0)
    expect(positions.at(-1)).toBe(1)
  })

  it('keeps the stop count bounded regardless of sample count', () => {
    const expression = gradeGradientExpression(buildProfile(line)!)
    expect((expression.length - 3) / 2).toBeLessThanOrEqual(130)
  })
})
