import { describe, expect, it } from 'vitest'
import { routeOf } from './route'

describe('routeOf', () => {
  it('resolves the about path', () => {
    expect(routeOf('/about')).toBe('about')
  })

  it('tolerates a trailing slash, which is what a hand-typed URL usually carries', () => {
    expect(routeOf('/about/')).toBe('about')
  })

  it('sends everything else to the map', () => {
    expect(routeOf('/')).toBe('map')
    expect(routeOf('')).toBe('map')
    expect(routeOf('/aboutish')).toBe('map')
    expect(routeOf('/about/extra')).toBe('map')
  })
})
