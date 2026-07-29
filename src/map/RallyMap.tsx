import { useEffect, useRef, useState } from 'react'
import { MapLibreMap, NavigationControl, ScaleControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { boundsOf, featuresForDay, stagesForDay, terminiFor } from '../domain/link'
import { emphasis } from '../domain/focus'
import { isClosedAt } from '../domain/time'
import type { Focus, RallyYear, StageCode } from '../domain/types'
import {
  ADELAIDE_HILLS_CENTER,
  BASEMAP_ATTRIBUTION,
  BASEMAP_STYLE_URL,
  DEFAULT_ZOOM,
} from './basemap'
import {
  casingLayer,
  hitLayer,
  hitLayerId,
  layerIdsForDay,
  lineLayer,
  sourceId,
  terminiLabelLayer,
  terminiLayer,
  terminiSourceId,
} from './layers'

const DAYS = [1, 2, 3]

interface Props {
  year: RallyYear
  day: number
  focus: Focus
  minutes: number | null
  onHover: (code: StageCode | null) => void
  onSelect: (code: StageCode | null) => void
  panelWidth: number
}

export function RallyMap({ year, day, focus, minutes, onHover, onSelect, panelWidth }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)

  const handlers = useRef({ onHover, onSelect })
  handlers.current = { onHover, onSelect }

  // featureId -> the stage code the map reports when that line is touched.
  // Repeat runs share a line, so the earliest run in the day owns the pointer.
  const codeByFeature = useRef(new Map<string, StageCode>())
  codeByFeature.current = new Map()
  for (const stage of stagesForDay(year, day)) {
    if (stage.featureId && !codeByFeature.current.has(stage.featureId)) {
      codeByFeature.current.set(stage.featureId, stage.code)
    }
  }

  useEffect(() => {
    if (!container.current || map.current) return

    const instance = new MapLibreMap({
      container: container.current,
      style: BASEMAP_STYLE_URL,
      center: ADELAIDE_HILLS_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { customAttribution: BASEMAP_ATTRIBUTION },
    })
    map.current = instance
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    instance.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right')

    instance.on('load', () => {
      for (const d of DAYS) {
        const features = featuresForDay(year, d)
        instance.addSource(sourceId(d), {
          type: 'geojson',
          promoteId: 'featureId',
          data: { type: 'FeatureCollection', features },
        })
        instance.addSource(terminiSourceId(d), {
          type: 'geojson',
          promoteId: 'featureId',
          data: terminiFor(features),
        })
        instance.addLayer(casingLayer(d))
        instance.addLayer(lineLayer(d))
        instance.addLayer(hitLayer(d))
        instance.addLayer(terminiLayer(d))
        instance.addLayer(terminiLabelLayer(d))

        instance.on('mousemove', hitLayerId(d), (event) => {
          const code = codeByFeature.current.get(String(event.features?.[0]?.id))
          instance.getCanvas().style.cursor = code ? 'pointer' : ''
          if (code) handlers.current.onHover(code)
        })
        instance.on('mouseleave', hitLayerId(d), () => {
          instance.getCanvas().style.cursor = ''
          handlers.current.onHover(null)
        })
        instance.on('click', hitLayerId(d), (event) => {
          const code = codeByFeature.current.get(String(event.features?.[0]?.id))
          if (code) {
            event.preventDefault()
            handlers.current.onSelect(code)
          }
        })
      }

      instance.on('click', (event) => {
        if (!event.defaultPrevented) handlers.current.onSelect(null)
      })

      setReady(true)
    })

    return () => {
      setReady(false)
      instance.remove()
      map.current = null
    }
    // Created once; every later change is pushed in through the effects below
    // rather than by tearing the instance down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return
    for (const d of DAYS) {
      for (const id of layerIdsForDay(d)) {
        instance.setLayoutProperty(id, 'visibility', d === day ? 'visible' : 'none')
      }
    }
  }, [ready, day])

  // Focus and closure changes only ever move feature-state; layers are never
  // added or removed, so the map never flashes.
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return

    for (const d of DAYS) {
      const stages = stagesForDay(year, d)
      for (const feature of featuresForDay(year, d)) {
        const featureId = feature.properties.featureId
        const owners = stages.filter((s) => s.featureId === featureId)
        const marks = owners.map((s) => emphasis(focus, s.code))
        const closed = owners.some((s) => {
          const closure = year.closures.find((c) => c.id === s.closureId)
          return closure && minutes !== null && isClosedAt(closure, minutes)
        })

        const state = {
          focused: marks.includes('focused'),
          dimmed: marks.length > 0 && marks.every((m) => m === 'dimmed'),
          closed,
        }
        instance.setFeatureState({ source: sourceId(d), id: featureId }, state)
        instance.setFeatureState({ source: terminiSourceId(d), id: featureId }, state)
      }
    }
  }, [ready, year, focus, minutes])

  const selectedCode = focus.kind === 'selected' ? focus.code : null

  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return

    const stage = selectedCode ? year.stages.find((s) => s.code === selectedCode) : null
    const target = stage?.featureId
      ? featuresForDay(year, stage.day).filter((f) => f.properties.featureId === stage.featureId)
      : featuresForDay(year, day)

    const bounds = boundsOf(target)
    if (!bounds) return

    instance.fitBounds(bounds, {
      duration: 600,
      padding: { top: 48, bottom: 48, right: 48, left: 48 + (selectedCode ? panelWidth : 0) },
    })
  }, [ready, year, day, selectedCode, panelWidth])

  return <div ref={container} className="rally-map" data-testid="rally-map" />
}
