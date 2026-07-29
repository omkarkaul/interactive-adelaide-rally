import { useEffect, useRef } from 'react'
import { MapLibreMap, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ADELAIDE_HILLS_CENTER, BASEMAP_STYLE_URL, DEFAULT_ZOOM } from './basemap'

export function RallyMap() {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)

  useEffect(() => {
    if (!container.current || map.current) return
    map.current = new MapLibreMap({
      container: container.current,
      style: BASEMAP_STYLE_URL,
      center: ADELAIDE_HILLS_CENTER,
      zoom: DEFAULT_ZOOM,
    })
    map.current.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  return <div ref={container} className="rally-map" data-testid="rally-map" />
}
