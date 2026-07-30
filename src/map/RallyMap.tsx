import { useEffect, useRef, useState } from 'react'
import { MapLibreMap, NavigationControl, ScaleControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { boundsOf, featuresForDay, stagesForDay, terminiFor } from '../domain/link'
import { emphasis } from '../domain/focus'
import { closureStateAt, combineStates } from '../ui/closureState'
import type { Focus, RallyYear, StageCode } from '../domain/types'
import { ADELAIDE_HILLS_CENTER, BASEMAP_STYLE_URL, DEFAULT_ZOOM } from './basemap'
import { cursorFromPoint, pointFromCursor } from '../domain/cursor'
import { gradeGradientExpression } from '../ui/grade'
import type { Cursor, StageDetail } from '../domain/types'
import {
  casingLayer,
  cursorLayer,
  CURSOR_SOURCE,
  DETAIL_SOURCE,
  detailArrowLayer,
  detailLayerIds,
  detailLineLayer,
  DETAIL_LAYER,
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
const CURSOR_TOLERANCE_PX = 44
const EMPTY = { type: 'FeatureCollection' as const, features: [] }

interface Props {
  year: RallyYear
  day: number
  focus: Focus
  minutes: number | null
  onHover: (code: StageCode | null) => void
  onSelect: (code: StageCode | null) => void
  panelWidth: number
  detail: StageDetail | null
  cursor: Cursor | null
  onCursor: (cursor: Cursor | null) => void
}

export function RallyMap({
  year,
  day,
  focus,
  minutes,
  onHover,
  onSelect,
  panelWidth,
  detail,
  cursor,
  onCursor,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)

  const handlers = useRef({ onHover, onSelect })
  handlers.current = { onHover, onSelect }

  // The pointer handler is bound once per stage, so it reads the live cursor and
  // callback through refs rather than being torn down on every cursor move.
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  const onCursorRef = useRef(onCursor)
  onCursorRef.current = onCursor
  const detailRef = useRef(detail)
  detailRef.current = detail

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
      // The Liberty style already declares OpenFreeMap, OpenMapTiles and
      // OpenStreetMap; adding our own only printed the credits twice.
      attributionControl: { compact: true },
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

      instance.addSource(DETAIL_SOURCE, { type: 'geojson', lineMetrics: true, data: EMPTY })
      instance.addSource(CURSOR_SOURCE, { type: 'geojson', data: EMPTY })
      instance.addLayer(detailLineLayer())
      instance.addLayer(detailArrowLayer())
      instance.addLayer(cursorLayer())

      // Touch never fires mousemove, so a tap is what places the cursor on a
      // phone. A tap near the open stage's line places it; anywhere else clears
      // the selection, which is the same gesture as clicking off on a desktop.
      instance.on('click', (event) => {
        if (event.defaultPrevented) return

        const open = detailRef.current
        if (open) {
          const next = cursorFromPoint(
            open.code,
            open.line,
            [event.lngLat.lng, event.lngLat.lat],
            cursorRef.current,
          )
          const projected = instance.project(pointFromCursor(open.line, next) as [number, number])
          if (Math.hypot(projected.x - event.point.x, projected.y - event.point.y) <= CURSOR_TOLERANCE_PX) {
            onCursorRef.current(next)
            return
          }
        }

        handlers.current.onSelect(null)
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
        const closureState = combineStates(
          owners.flatMap((s) => {
            const closure = year.closures.find((c) => c.id === s.closureId)
            return closure ? [closureStateAt(closure, minutes)] : []
          }),
        )

        const state = {
          focused: marks.includes('focused'),
          dimmed: marks.length > 0 && marks.every((m) => m === 'dimmed'),
          closureState,
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

  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return

    const source = instance.getSource(DETAIL_SOURCE) as { setData: (d: unknown) => void } | undefined
    source?.setData(detail ? { type: 'FeatureCollection', features: [detail.line] } : EMPTY)

    for (const id of detailLayerIds) {
      instance.setLayoutProperty(id, 'visibility', detail ? 'visible' : 'none')
    }

    if (detail?.profile) {
      instance.setPaintProperty(
        DETAIL_LAYER,
        'line-gradient',
        gradeGradientExpression(detail.profile) as never,
      )
    }
  }, [ready, detail])

  // rAF-throttled: MapLibre fires mousemove far faster than the cursor needs to move.
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready || !detail) return

    let frame = 0
    let latest: { x: number; y: number; lng: number; lat: number } | null = null

    const resolve = () => {
      frame = 0
      if (!latest) return
      const next = cursorFromPoint(detail.code, detail.line, [latest.lng, latest.lat], cursorRef.current)
      // Tolerance has to be a screen distance: a fixed number of degrees would
      // mean metres at one zoom and kilometres at another.
      const projected = instance.project(pointFromCursor(detail.line, next) as [number, number])
      const offsetPx = Math.hypot(projected.x - latest.x, projected.y - latest.y)
      onCursorRef.current(offsetPx <= CURSOR_TOLERANCE_PX ? next : null)
    }

    const onMove = (event: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => {
      latest = { x: event.point.x, y: event.point.y, lng: event.lngLat.lng, lat: event.lngLat.lat }
      if (!frame) frame = requestAnimationFrame(resolve)
    }
    const onLeave = () => onCursorRef.current(null)

    instance.on('mousemove', onMove)
    instance.on('mouseout', onLeave)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      instance.off('mousemove', onMove)
      instance.off('mouseout', onLeave)
    }
  }, [ready, detail])

  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return

    const source = instance.getSource(CURSOR_SOURCE) as { setData: (d: unknown) => void } | undefined
    if (!source) return

    if (!detail || !cursor || cursor.code !== detail.code) {
      source.setData(EMPTY)
      return
    }

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: pointFromCursor(detail.line, cursor) },
        },
      ],
    })
  }, [ready, detail, cursor])

  return <div ref={container} className="rally-map" data-testid="rally-map" />
}
