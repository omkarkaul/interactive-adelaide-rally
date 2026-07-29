import { vi } from 'vitest'

type Handler = (event: unknown) => void

export interface FakeMap {
  sources: Map<string, unknown>
  layers: string[]
  featureState: Map<string, Record<string, unknown>>
  layoutProperties: Map<string, unknown>
  fitBounds: ReturnType<typeof vi.fn>
  fireLoad: () => void
  fire: (type: string, layerId: string | null, event: unknown) => void
}

export const maps: FakeMap[] = []

export class FakeMapLibreMap implements FakeMap {
  sources = new Map<string, unknown>()
  layers: string[] = []
  featureState = new Map<string, Record<string, unknown>>()
  layoutProperties = new Map<string, unknown>()
  fitBounds = vi.fn()
  private handlers = new Map<string, Handler[]>()

  constructor() {
    maps.push(this)
  }

  private key(type: string, layerId?: string | null) {
    return layerId ? `${type}:${layerId}` : type
  }

  on(type: string, layerOrHandler: string | Handler, maybeHandler?: Handler) {
    const layerId = typeof layerOrHandler === 'string' ? layerOrHandler : null
    const handler = (typeof layerOrHandler === 'string' ? maybeHandler : layerOrHandler)!
    const key = this.key(type, layerId)
    this.handlers.set(key, [...(this.handlers.get(key) ?? []), handler])
    return this
  }

  fire(type: string, layerId: string | null, event: unknown) {
    for (const handler of this.handlers.get(this.key(type, layerId)) ?? []) handler(event)
  }

  fireLoad() {
    this.fire('load', null, {})
  }

  addControl() {
    return this
  }
  addSource(id: string, source: unknown) {
    this.sources.set(id, source)
    return this
  }
  addLayer(layer: { id: string }) {
    this.layers.push(layer.id)
    return this
  }
  getLayer(id: string) {
    return this.layers.includes(id) ? { id } : undefined
  }
  getSource(id: string) {
    return this.sources.get(id)
  }
  setLayoutProperty(id: string, property: string, value: unknown) {
    this.layoutProperties.set(`${id}.${property}`, value)
    return this
  }
  setFeatureState(target: { source: string; id: string }, state: Record<string, unknown>) {
    this.featureState.set(`${target.source}/${target.id}`, state)
    return this
  }
  getCanvas() {
    return { style: {} as Record<string, string> }
  }
  remove() {}
}
