import type { LocationPreference, ShoppingLocation } from '../types/location'

const KEY = 'evstok.shoppingLocations'

const EMPTY: LocationPreference = {
  mode: 'live',
  savedId: null,
  places: [],
}

function normalize(raw: Partial<LocationPreference> | null): LocationPreference {
  if (!raw) return { ...EMPTY }
  const places = Array.isArray(raw.places)
    ? raw.places.filter(
        (p): p is ShoppingLocation =>
          Boolean(p?.id && p?.name && Number.isFinite(p.lat) && Number.isFinite(p.lng)),
      )
    : []
  const mode = raw.mode === 'saved' ? 'saved' : 'live'
  const savedId =
    mode === 'saved' && places.some((p) => p.id === raw.savedId) ? (raw.savedId ?? null) : null
  return {
    mode: savedId ? 'saved' : 'live',
    savedId,
    places,
  }
}

export const locationPrefsStore = {
  load(): LocationPreference {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return { ...EMPTY }
      return normalize(JSON.parse(raw) as Partial<LocationPreference>)
    } catch {
      return { ...EMPTY }
    }
  },

  save(prefs: LocationPreference): void {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  },
}
