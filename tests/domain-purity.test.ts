import { describe, expect, it } from 'vitest'

const sources = import.meta.glob('/src/domain/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const modules = Object.entries(sources).filter(([path]) => !path.endsWith('.test.ts'))

const FORBIDDEN_IMPORTS = /from\s+['"](react|react-dom|react\/|maplibre-gl)/
const FORBIDDEN_GLOBALS = /(^|[^.\w])(document|window|navigator|localStorage|HTMLElement)\s*[.[]/

describe('src/domain imports nothing from React, MapLibre or the DOM', () => {
  it('covers every domain module', () => {
    expect(modules.length).toBeGreaterThan(5)
  })

  it.each(modules)('%s', (_path, source) => {
    const code = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(FORBIDDEN_IMPORTS)
    expect(code).not.toMatch(FORBIDDEN_GLOBALS)
  })
})
