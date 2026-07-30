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
  terminus: token('--text-secondary'),
  accent: token('--accent'),
} as const

export const sourceId = (day: number) => `stages-day-${day}`
export const terminiSourceId = (day: number) => `termini-day-${day}`
export const casingLayerId = (day: number) => `stages-casing-day-${day}`
export const lineLayerId = (day: number) => `stages-line-day-${day}`
export const reopenedDashLayerId = (day: number) => `stages-reopened-dash-day-${day}`
export const hitLayerId = (day: number) => `stages-hit-day-${day}`
export const terminiLayerId = (day: number) => `termini-day-${day}`
export const terminiLabelLayerId = (day: number) => `termini-label-day-${day}`
export const codeLabelLayerId = (day: number) => `stages-code-day-${day}`

const state = (key: string) => ['boolean', ['feature-state', key], false]

const DIM_OPACITY = 0.2

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

// Closed cannot out-brighten the other two — no grey that clears the basemap
// contrast floor is dimmer than the red — so it dominates by weight instead.
const WIDTH = { focused: 8, dimmed: 3, pending: 4, closed: 6, reopened: 3 }

const lineWidth = byZoom((s) => [
  'case',
  state('focused'),
  WIDTH.focused * s,
  state('dimmed'),
  WIDTH.dimmed * s,
  byState(WIDTH.pending * s, WIDTH.closed * s, WIDTH.reopened * s),
])

// A focused line carries a 2px casing each side; everything else gets 1px.
const casingWidth = byZoom((s) => [
  'case',
  state('focused'),
  WIDTH.focused * s + 4,
  state('dimmed'),
  WIDTH.dimmed * s + 2,
  byState(WIDTH.pending * s + 2, WIDTH.closed * s + 2, WIDTH.reopened * s + 2),
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
      'line-opacity': dimmed(DIM_OPACITY, 1) as never,
      'line-width': lineWidth as never,
    },
  }
}

// Reopened is told apart from pending by dash, not by lightness. No two greys can
// be further apart than 1.23:1 while both clear the basemap contrast floor, so a
// pattern difference is the only one available. Punching casing-coloured gaps into
// the line is how, since line-dasharray itself cannot be driven by feature-state.
export function reopenedDashLayer(day: number): LineLayerSpecification {
  return {
    id: reopenedDashLayerId(day),
    type: 'line',
    source: sourceId(day),
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: {
      'line-color': COLOR.casing,
      'line-dasharray': [1.4, 1.4],
      // Wider than the line so the gaps cut the casing too. Sized to the line, the
      // casing survived in every gap and filled the dash back in.
      'line-width': casingWidth as never,
      'line-opacity': [
        'match',
        ['string', ['feature-state', 'closureState'], 'pending'],
        'reopened',
        dimmed(0.2, 1),
        0,
      ] as never,
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
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 14, 4.5] as never,
      // Start is filled, finish is hollow. Direction is a form difference, not a
      // hue one — hue is spoken for by closure state.
      'circle-color': ['match', ['get', 'role'], 'start', COLOR.terminus, COLOR.casing] as never,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': COLOR.terminus,
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
    // Held back to 13 so the stage codes own the zoom band where they first
    // appear. Filled-vs-hollow already says which end is which; twenty repeats
    // of "Start" and "Finish" were beating the codes in symbol collision.
    minzoom: 13,
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

// Names the line on the map so the route can be identified without crossing to
// the panel. Below zoom 11 the stages are too short to carry a label.
export function codeLabelLayer(day: number): SymbolLayerSpecification {
  return {
    id: codeLabelLayerId(day),
    type: 'symbol',
    source: sourceId(day),
    minzoom: 11,
    layout: {
      'text-field': ['get', 'codeLabel'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      // Placed on the line but kept upright. Aligned to the map, a code sitting
      // on one of the Corkscrew hairpins came out sideways and upside down.
      'symbol-placement': 'point',
      // Lifted clear of the line. Sitting on it, the route showed through the
      // space in "SS4 / SS7" and read as a second slash.
      'text-offset': [0, -1.3],
      'text-allow-overlap': false,
      'text-padding': 3,
    },
    paint: {
      'text-color': COLOR.label,
      'text-halo-color': COLOR.casing,
      'text-halo-width': 2,
      'text-halo-blur': 0.5,
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
  reopenedDashLayerId(day),
  hitLayerId(day),
  terminiLayerId(day),
  terminiLabelLayerId(day),
  codeLabelLayerId(day),
]
