import type {
  CircleLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'

export const COLOR = {
  line: '#ff6b3d',
  focused: '#ffd23f',
  closed: '#e5484d',
  casing: '#1b1d24',
  start: '#3ddc84',
  finish: '#e5484d',
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

export function casingLayer(day: number): LineLayerSpecification {
  return {
    id: casingLayerId(day),
    type: 'line',
    source: sourceId(day),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': COLOR.casing,
      'line-opacity': dimmed(0.25, 0.9) as never,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        ['case', state('focused'), 6, 4],
        14,
        ['case', state('focused'), 12, 9],
      ] as never,
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
      'line-color': [
        'case',
        state('focused'),
        COLOR.focused,
        state('closed'),
        COLOR.closed,
        COLOR.line,
      ] as never,
      'line-opacity': dimmed(0.28, 1) as never,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        ['case', state('focused'), 3.5, 2],
        14,
        ['case', state('focused'), 8, 5],
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
    paint: { 'line-color': COLOR.line, 'line-opacity': 0, 'line-width': 20 },
  }
}

export function terminiLayer(day: number): CircleLayerSpecification {
  return {
    id: terminiLayerId(day),
    type: 'circle',
    source: terminiSourceId(day),
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6] as never,
      'circle-color': ['match', ['get', 'role'], 'start', COLOR.start, COLOR.finish] as never,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': COLOR.casing,
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
      'text-color': '#f2f4f8',
      'text-halo-color': COLOR.casing,
      'text-halo-width': 1.2,
      'text-opacity': dimmed(0.2, 1) as never,
    },
  }
}

export const layerIdsForDay = (day: number) => [
  casingLayerId(day),
  lineLayerId(day),
  hitLayerId(day),
  terminiLayerId(day),
  terminiLabelLayerId(day),
]
