import { config } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// MapLibre resolves its worker with new URL(..., import.meta.url), which the
// bundler does not rewrite, so the built app 404s on the worker and silently
// falls back to a classic one. Pointing at the hashed asset fixes that.
config.WORKER_URL = workerUrl

export const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export const ADELAIDE_HILLS_CENTER: [number, number] = [138.75, -34.93]
export const DEFAULT_ZOOM = 10

export const BASEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
