import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { DEFAULT_MAP_CENTER } from '../lib/geocode'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Vite + Leaflet varsayılan ikon yolu düzeltmesi
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

type Props = {
  lat: number
  lng: number
  /** Merkezi yeniden kurmak için artır (GPS’e getir vb.) */
  resetKey?: number
  onPick: (coords: { lat: number; lng: number }) => void
}

export function LocationMapFrame({ lat, lng, resetKey = 0, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!containerRef.current) return

    const startLat = Number.isFinite(lat) ? lat : DEFAULT_MAP_CENTER.lat
    const startLng = Number.isFinite(lng) ? lng : DEFAULT_MAP_CENTER.lng

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([startLat, startLng], 15)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map)

    function emit(ll: L.LatLng) {
      onPickRef.current({ lat: ll.lat, lng: ll.lng })
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      emit(e.latlng)
    })
    marker.on('dragend', () => emit(marker.getLatLng()))

    mapRef.current = map
    markerRef.current = marker

    const t = window.setTimeout(() => {
      map.invalidateSize()
      emit(marker.getLatLng())
    }, 200)

    return () => {
      window.clearTimeout(t)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Sadece resetKey değişince yeniden kur — pin her oynadığında değil
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  return (
    <div className="loc-map-wrap">
      <p className="loc-map-hint">Haritaya tıkla veya iğneyi sürükle</p>
      <div ref={containerRef} className="loc-map" />
    </div>
  )
}
