import { useEffect, useState } from 'react'
import {
  DEFAULT_MAP_CENTER,
  isValidTurkeyCoord,
  reverseGeocode,
  searchPlaces,
} from '../lib/geocode'
import { resolveLiveLocation } from '../lib/location'
import { locationPrefsStore } from '../lib/locationPrefsStore'
import type { GeocodeHit, LocationPreference, ShoppingLocation } from '../types/location'
import { LocationMapFrame } from './LocationMapFrame'

type Props = {
  prefs: LocationPreference
  onChange: (prefs: LocationPreference) => void
}

type AddMode = 'address' | 'map' | 'gps'

export function LocationPicker({ prefs, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [addMode, setAddMode] = useState<AddMode>('address')
  const [name, setName] = useState('Ev')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<GeocodeHit[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [mapPin, setMapPin] = useState(DEFAULT_MAP_CENTER)
  const [mapLabel, setMapLabel] = useState('Haritadan seçilen nokta')

  useEffect(() => {
    if (!adding || addMode !== 'map') return
    let cancelled = false
    const t = window.setTimeout(() => {
      void reverseGeocode(mapPin.lat, mapPin.lng).then((hit) => {
        if (!cancelled && hit) setMapLabel(hit.label)
      })
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [adding, addMode, mapPin.lat, mapPin.lng])

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
    if (!isValidTurkeyCoord(place.lat, place.lng)) {
      setErr('Seçilen nokta Türkiye dışında. Haritadan veya adresle yeniden dene.')
      return
    }
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

  async function runAddressSearch() {
    const q = query.trim()
    if (q.length < 3) {
      setErr('En az 3 karakterlik açık adres yaz (mahalle, cadde, semt…).')
      return
    }
    setSearching(true)
    setErr(null)
    try {
      const found = await searchPlaces(q)
      setHits(found)
      if (found.length === 0) setErr('Adres bulunamadı. Daha açık yaz veya haritadan seç.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Adres araması başarısız')
      setHits([])
    } finally {
      setSearching(false)
    }
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
    addPlace({
      name: name.trim() || hit.name,
      lat: hit.lat,
      lng: hit.lng,
      label: hit.label,
    })
  }

  function saveMapPin() {
    addPlace({
      name: name.trim() || 'Harita konumu',
      lat: mapPin.lat,
      lng: mapPin.lng,
      label: mapLabel,
    })
  }

  async function centerMapOnGps() {
    setBusy(true)
    setErr(null)
    try {
      const loc = await resolveLiveLocation()
      setMapPin({ lat: loc.lat, lng: loc.lng })
      setMapLabel(loc.label)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Konum alınamadı')
    } finally {
      setBusy(false)
    }
  }

  const selected = prefs.places.find((p) => p.id === prefs.savedId)

  return (
    <div className="loc-picker">
      <div className="loc-head">
        <span className="label">Alışveriş konumu</span>
        <button
          type="button"
          className="btn-chip"
          onClick={() => {
            setAdding((v) => !v)
            setErr(null)
            setMsg(null)
          }}
        >
          {adding ? 'Kapat' : '+ Konum ekle'}
        </button>
      </div>
      <p className="loc-hint">
        İşteyken eve göre hesapla: açık adres yaz veya haritadan pin koy, sonra “Ev” seç.
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
        <div className="banner ok">
          {selected.name}: {selected.label}
          <br />
          <small>
            {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
          </small>
        </div>
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

          <div className="filters loc-chips" role="tablist" aria-label="Ekleme yöntemi">
            <button
              type="button"
              className={addMode === 'address' ? 'active' : ''}
              onClick={() => setAddMode('address')}
            >
              Açık adres
            </button>
            <button
              type="button"
              className={addMode === 'map' ? 'active' : ''}
              onClick={() => setAddMode('map')}
            >
              Harita
            </button>
            <button
              type="button"
              className={addMode === 'gps' ? 'active' : ''}
              onClick={() => setAddMode('gps')}
            >
              Anlık GPS
            </button>
          </div>

          {addMode === 'address' ? (
            <>
              <label className="field">
                <span>Açık adres</span>
                <textarea
                  rows={3}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Örn. Caferağa Mah. Moda Cad. No:12 Kadıköy İstanbul"
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={searching}
                onClick={() => void runAddressSearch()}
              >
                {searching ? 'Aranıyor…' : 'Adresi bul'}
              </button>
              {hits.length > 0 ? (
                <div className="loc-hits">
                  {hits.map((h) => (
                    <button key={h.id} type="button" className="loc-hit" onClick={() => saveHit(h)}>
                      <strong>{h.name}</strong>
                      <small>{h.label}</small>
                      <small>
                        {h.lat.toFixed(5)}, {h.lng.toFixed(5)}
                      </small>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {addMode === 'map' ? (
            <>
              <LocationMapFrame
                lat={mapPin.lat}
                lng={mapPin.lng}
                onPick={(coords) => setMapPin(coords)}
              />
              <div className="banner">{mapLabel}</div>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void centerMapOnGps()}
              >
                Haritayı anlık konuma getir
              </button>
              <button type="button" className="btn btn-primary" onClick={saveMapPin}>
                Bu pin’i kaydet
              </button>
            </>
          ) : null}

          {addMode === 'gps' ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void saveCurrent()}
            >
              {busy ? 'Konum alınıyor…' : 'Şu anki konumumu kaydet'}
            </button>
          ) : null}

          {prefs.places.length > 0 ? (
            <div className="loc-manage">
              {prefs.places.map((p) => (
                <div key={p.id} className="loc-manage-row">
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.label}</small>
                  </span>
                  <button
                    type="button"
                    className="btn-chip danger-text"
                    onClick={() => removePlace(p.id)}
                  >
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
