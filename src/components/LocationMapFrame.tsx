import { useEffect, useMemo, useRef } from 'react'
import { buildMapPickerHtml, DEFAULT_MAP_CENTER } from '../lib/geocode'

type Props = {
  lat: number
  lng: number
  onPick: (coords: { lat: number; lng: number }) => void
}

export function LocationMapFrame({ lat, lng, onPick }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const html = useMemo(
    () =>
      buildMapPickerHtml(
        Number.isFinite(lat) ? lat : DEFAULT_MAP_CENTER.lat,
        Number.isFinite(lng) ? lng : DEFAULT_MAP_CENTER.lng,
      ),
    // Harita yalnızca ekleme açılınca / merkez değişince yeniden kurulur
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat.toFixed(4), lng.toFixed(4)],
  )

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return
      try {
        const data =
          typeof event.data === 'string' ? (JSON.parse(event.data) as { type?: string; lat?: number; lng?: number }) : null
        if (!data || data.type !== 'pick') return
        if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return
        onPick({ lat: data.lat!, lng: data.lng! })
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onPick])

  return (
    <iframe
      ref={iframeRef}
      className="loc-map"
      title="Haritadan konum seç"
      sandbox="allow-scripts allow-same-origin"
      srcDoc={html}
    />
  )
}
