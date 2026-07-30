import type {
  CircleLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import { token } from '../tokens'

export const COLOR = {
  pending: token('--state-pending'),
  closed: token('--state-closed'),
  reopened: token('--state-reopened'),
  casing: token('--map-casing'),
  label: token('--text-primary'),
  accent: token('--accent'),
} as const

export const sourceId = (day: number) => `stages-day-${day}`
export const terminiSourceId = (day: number) => `termini-day-${day}`
export const casingLayerId = (day: number) => `stages-casing-day-${day}`
export const lineLayerId = (day: number) => `stages-line-day-${day}`
export const hitLayerId = (day: number) => `stages-hit-day-${day}`
export const terminiLayerId = (day: number) => `termini-day-${day}`
export const terminiLabelLayerId = (day: number) => `termini-label-day-${day}`

const state = (key: string) => ['boolean', ['feature-state', key], false]

const dimmed = (dimmedValue: unknown, normal: unknown) => [
  'case',
  state('dimmed'),
  dimmedValue,
  normal,
]

// Hue carries closure state and nothing else. Focus is expressed only through
// opacity and width, so a dimmed closed stage stays red rather than turning grey.
const byState = (pending: unknown, closed: unknown, reopened: unknown) => [
  'match',
  ['string', ['feature-state', 'closureState'], 'pending'],
  'closed',
  closed,
  'reopened',
  reopened,
  pending,
]

// Widths are quoted per the spec at zoom 12 and scaled from there, so the ratios
// between the three states survive zooming. A zoom interpolation has to be the
// outermost expression — wrapping one in an arithmetic operator makes MapLibre
// reject the paint property, and the layer then draws nothing at all.
const SCALE: [number, number][] = [
  [8, 0.75],
  [12, 1],
  [14, 1.3],
]

const byZoom = (widthAt: (scale: number) => unknown) => [
  'interpolate',
  ['linear'],
  ['zoom'],
  ...SCALE.flatMap(([zoom, scale]) => [zoom, widthAt(scale)]),
]

const lineWidth = byZoom((s) => [
  'case',
  state('focused'),
  6 * s,
  state('dimmed'),
  3 * s,
  byState(3 * s, 4 * s, 2 * s),
])

// A focused line carries a 2px casing each side; everything else gets 1px.
const casingWidth = byZoom((s) => [
  'case',
  state('focused'),
  6 * s + 4,
  state('dimmed'),
  3 * s + 2,
  byState(3 * s + 2, 4 * s + 2, 2 * s + 2),
])

export function casingLayer(day: number): LineLayerSpecification {
  return {
    id: casingLayerId(day),
    type: 'line',
    source: sourceId(day),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': COLOR.casing,
      'line-opacity': dimmed(0.2, 0.9) as never,
      'line-width': casingWidth as never,
    },
  }
}

export function lineLayer(day: number): LineLayerSpecification {
  return {
    id: lineLayerId(day),
    type: 'line',
    source: sourceId(day),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': byState(COLOR.pending, COLOR.closed, COLOR.reopened) as never,
      'line-opacity': ['case', state('focused'), 1, state('dimmed'), 0.2, 0.85] as never,
      'line-width': lineWidth as never,
    },
  }
}

// Lines are a few pixels wide; this invisible band is what the pointer actually hits.
export function hitLayer(day: number): LineLayerSpecification {
  return {
    id: hitLayerId(day),
    type: 'line',
    source: sourceId(day),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': COLOR.pending, 'line-opacity': 0, 'line-width': 20 },
  }
}

export function terminiLayer(day: number): CircleLayerSpecification {
  return {
    id: terminiLayerId(day),
    type: 'circle',
    source: terminiSourceId(day),
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6] as never,
      // Start is filled, finish is hollow. Direction is a form difference, not a
      // hue one — hue is spoken for by closure state.
      'circle-color': ['match', ['get', 'role'], 'start', COLOR.label, COLOR.casing] as never,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': COLOR.label,
      'circle-opacity': dimmed(0.2, 1) as never,
      'circle-stroke-opacity': dimmed(0.2, 1) as never,
    },
  }
}

export function terminiLabelLayer(day: number): SymbolLayerSpecification {
  return {
    id: terminiLabelLayerId(day),
    type: 'symbol',
    source: terminiSourceId(day),
    minzoom: 11,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': COLOR.label,
      'text-halo-color': COLOR.casing,
      'text-halo-width': 1.2,
      'text-opacity': dimmed(0.2, 1) as never,
    },
  }
}

export const DETAIL_SOURCE = 'detail-line'
export const DETAIL_LAYER = 'detail-line-grade'
export const DETAIL_ARROW_LAYER = 'detail-line-arrows'
export const CURSOR_SOURCE = 'detail-cursor'
export const CURSOR_LAYER = 'detail-cursor-dot'

// The selected stage is redrawn on its own lineMetrics source so it can carry a
// line-gradient, which is the same grade ramp the elevation profile uses.
export function detailLineLayer(): LineLayerSpecification {
  return {
    id: DETAIL_LAYER,
    type: 'line',
    source: DETAIL_SOURCE,
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 9] as never,
      'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, token('--g-flat')] as never,
    },
  }
}

export function detailArrowLayer(): SymbolLayerSpecification {
  return {
    id: DETAIL_ARROW_LAYER,
    type: 'symbol',
    source: DETAIL_SOURCE,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 90,
      'text-field': '▸',
      'text-font': ['Noto Sans Regular'],
      'text-size': 15,
      'text-keep-upright': false,
      'text-allow-overlap': true,
      'text-rotation-alignment': 'map',
    },
    paint: {
      'text-color': COLOR.label,
      'text-halo-color': COLOR.casing,
      'text-halo-width': 1.4,
    },
  }
}

export function cursorLayer(): CircleLayerSpecification {
  return {
    id: CURSOR_LAYER,
    type: 'circle',
    source: CURSOR_SOURCE,
    paint: {
      'circle-radius': 6,
      'circle-color': COLOR.accent,
      'circle-stroke-width': 2,
      'circle-stroke-color': COLOR.casing,
    },
  }
}

export const detailLayerIds = [DETAIL_LAYER, DETAIL_ARROW_LAYER, CURSOR_LAYER]

export const layerIdsForDay = (day: number) => [
  casingLayerId(day),
  lineLayerId(day),
  hitLayerId(day),
  terminiLayerId(day),
  terminiLabelLayerId(day),
]
