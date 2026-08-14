import type { LocationPreference } from '../types/location'

export type UserLocation = {
  lat: number
  lng: number
  label: string
  accuracyM: number | null
}

export class LocationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocationError'
  }
}

/** Tarayıcı GPS konumunu ister. İzin yoksa hata fırlatır. */
export async function resolveLiveLocation(): Promise<UserLocation> {
  if (!('geolocation' in navigator)) {
    throw new LocationError('Bu tarayıcı konum desteklemiyor.')
  }

  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    })
  }).catch((err: GeolocationPositionError | Error) => {
    if ('code' in err) {
      if (err.code === err.PERMISSION_DENIED) {
        throw new LocationError('Konum izni gerekli. Tarayıcı ayarlarından izin verip tekrar dene.')
      }
      if (err.code === err.POSITION_UNAVAILABLE) {
        throw new LocationError('Konum alınamadı. Konum servislerini açıp tekrar dene.')
      }
      if (err.code === err.TIMEOUT) {
        throw new LocationError('Konum zaman aşımına uğradı. Tekrar dene.')
      }
    }
    throw new LocationError(err instanceof Error ? err.message : 'Konum alınamadı')
  })

  const lat = pos.coords.latitude
  const lng = pos.coords.longitude
  const accuracyM = pos.coords.accuracy ?? null
  const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`

  return { lat, lng, label, accuracyM }
}

/** Bütçe hesabı için seçili kaynağı çözümler (anlık veya kayıtlı). */
export async function resolveBudgetLocation(
  prefs: LocationPreference,
): Promise<UserLocation> {
  if (prefs.mode === 'saved' && prefs.savedId) {
    const place = prefs.places.find((p) => p.id === prefs.savedId)
    if (!place) {
      throw new LocationError('Kayıtlı konum bulunamadı. Yeniden seç veya anlık konum kullan.')
    }
    return {
      lat: place.lat,
      lng: place.lng,
      label: `${place.name} · ${place.label}`,
      accuracyM: null,
    }
  }
  return resolveLiveLocation()
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
