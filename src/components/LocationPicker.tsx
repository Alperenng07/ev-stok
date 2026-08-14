import { useEffect, useState } from 'react'
import { searchPlaces } from '../lib/geocode'
import { resolveLiveLocation } from '../lib/location'
import { locationPrefsStore } from '../lib/locationPrefsStore'
import type { GeocodeHit, LocationPreference, ShoppingLocation } from '../types/location'

type Props = {
  prefs: LocationPreference
  onChange: (prefs: LocationPreference) => void
}

export function LocationPicker({ prefs, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('Ev')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<GeocodeHit[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!adding || query.trim().length < 2) {
      setHits([])
      return
    }
    const t = window.setTimeout(() => {
      void searchPlaces(query)
        .then(setHits)
        .catch(() => setHits([]))
    }, 350)
    return () => window.clearTimeout(t)
  }, [adding, query])

  function persist(next: LocationPreference) {
    locationPrefsStore.save(next)
    onChange(next)
  }

  function selectLive() {
    persist({ ...prefs, mode: 'live', savedId: null })
  }

  function selectSaved(id: string) {
    persist({ ...prefs, mode: 'saved', savedId: id })
  }

  function removePlace(id: string) {
    const places = prefs.places.filter((p) => p.id !== id)
    const savedId = prefs.savedId === id ? null : prefs.savedId
    persist({
      places,
      savedId,
      mode: savedId ? 'saved' : 'live',
    })
  }

  function addPlace(place: Omit<ShoppingLocation, 'id' | 'createdAt'>) {
    const next: ShoppingLocation = {
      ...place,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    const places = [...prefs.places, next]
    persist({ mode: 'saved', savedId: next.id, places })
    setAdding(false)
    setQuery('')
    setHits([])
    setMsg(`“${next.name}” kaydedildi ve seçildi.`)
    setErr(null)
  }

  async function saveCurrent() {
    const trimmed = name.trim()
    if (trimmed.length < 1) {
      setErr('Konuma bir ad ver (ör. Ev, İş).')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const loc = await resolveLiveLocation()
      addPlace({
        name: trimmed,
        lat: loc.lat,
        lng: loc.lng,
        label: loc.label,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Konum alınamadı')
    } finally {
      setBusy(false)
    }
  }

  function saveHit(hit: GeocodeHit) {
    const trimmed = name.trim() || hit.name
    addPlace({
      name: trimmed,
      lat: hit.lat,
      lng: hit.lng,
      label: hit.label,
    })
  }

  const selected = prefs.places.find((p) => p.id === prefs.savedId)

  return (
    <div className="loc-picker">
      <div className="loc-head">
        <span className="label">Alışveriş konumu</span>
        <button type="button" className="btn-chip" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Kapat' : '+ Konum ekle'}
        </button>
      </div>
      <p className="loc-hint">
        İşteyken eve göre hesaplamak için “Ev” kaydet; hesaplamada onu seç.
      </p>

      <div className="filters loc-chips" role="tablist" aria-label="Konum kaynağı">
        <button
          type="button"
          role="tab"
          aria-selected={prefs.mode === 'live'}
          className={prefs.mode === 'live' ? 'active' : ''}
          onClick={selectLive}
        >
          Anlık konum
        </button>
        {prefs.places.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={prefs.mode === 'saved' && prefs.savedId === p.id}
            className={prefs.mode === 'saved' && prefs.savedId === p.id ? 'active' : ''}
            onClick={() => selectSaved(p.id)}
            title={p.label}
          >
            {p.name}
          </button>
        ))}
      </div>

      {prefs.mode === 'saved' && selected ? (
        <div className="banner ok">{selected.name}: {selected.label}</div>
      ) : (
        <div className="banner">Hesaplama cihazının anlık GPS konumuna göre yapılır.</div>
      )}

      {msg ? <div className="banner ok">{msg}</div> : null}
      {err ? <div className="banner err">{err}</div> : null}

      {adding ? (
        <div className="loc-add">
          <label className="field">
            <span>Konum adı</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ev, İş, Anne evi…"
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void saveCurrent()}
          >
            {busy ? 'Konum alınıyor…' : 'Şu anki konumumu kaydet'}
          </button>
          <label className="field">
            <span>veya adres / semt ara</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Örn. Kadıköy, Çankaya…"
            />
          </label>
          {hits.length > 0 ? (
            <div className="loc-hits">
              {hits.map((h) => (
                <button key={h.id} type="button" className="loc-hit" onClick={() => saveHit(h)}>
                  <strong>{h.name}</strong>
                  <small>{h.label}</small>
                </button>
              ))}
            </div>
          ) : null}
          {prefs.places.length > 0 ? (
            <div className="loc-manage">
              {prefs.places.map((p) => (
                <div key={p.id} className="loc-manage-row">
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.label}</small>
                  </span>
                  <button type="button" className="btn-chip danger-text" onClick={() => removePlace(p.id)}>
                    Sil
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
