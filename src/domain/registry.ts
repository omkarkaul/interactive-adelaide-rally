const EVENT_MODULES = import.meta.glob('/data/*/event.json', { import: 'default' }) as Record<
  string,
  () => Promise<unknown>
>

const SOURCE_MODULES = import.meta.glob('/data/*/sources.json', { import: 'default' }) as Record<
  string,
  () => Promise<unknown>
>

// .geojson is not a JSON extension Vite parses, so these load as raw text.
const GEOMETRY_MODULES = import.meta.glob('/data/*/geometry/day-*.geojson', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

const yearOf = (path: string): number => Number(path.split('/')[2])

export function availableYears(): number[] {
  return Object.keys(EVENT_MODULES)
    .map(yearOf)
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => b - a)
}

export function datasetPath(year: number): string {
  return `/data/${year}`
}

export function eventLoader(year: number): () => Promise<unknown> {
  const loader = EVENT_MODULES[`${datasetPath(year)}/event.json`]
  if (!loader) throw new Error(`No dataset for year ${year}`)
  return loader
}

export function sourcesLoader(year: number): () => Promise<unknown> {
  const loader = SOURCE_MODULES[`${datasetPath(year)}/sources.json`]
  if (!loader) throw new Error(`No sources.json for year ${year}`)
  return loader
}

export function geometryLoaders(year: number): (() => Promise<string>)[] {
  const prefix = `${datasetPath(year)}/geometry/`
  return Object.entries(GEOMETRY_MODULES)
    .filter(([path]) => path.startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, loader]) => loader)
}
