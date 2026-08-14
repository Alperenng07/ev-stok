import { useEffect, useState } from 'react'
import {
  DEFAULT_MAP_CENTER,
  isValidTurkeyCoord,
  reverseGeocode,
  searchStructuredAddress,
  type StructuredAddress,
} from '../lib/geocode'
import { resolveLiveLocation } from '../lib/location'
import { locationPrefsStore } from '../lib/locationPrefsStore'
import { TURKEY_PROVINCES } from '../lib/turkeyProvinces'
import type { GeocodeHit, LocationPreference, ShoppingLocation } from '../types/location'
import { LocationMapFrame } from './LocationMapFrame'

type Props = {
  prefs: LocationPreference
  onChange: (prefs: LocationPreference) => void
}

type AddMode = 'form' | 'map' | 'gps'

const EMPTY_ADDR: StructuredAddress = {
  province: 'İstanbul',
  district: '',
  neighborhood: '',
  street: '',
  buildingNo: '',
}

export function LocationPicker({ prefs, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [addMode, setAddMode] = useState<AddMode>('form')
  const [name, setName] = useState('Ev')
  const [addr, setAddr] = useState<StructuredAddress>(EMPTY_ADDR)
  const [hits, setHits] = useState<GeocodeHit[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [mapPin, setMapPin] = useState(DEFAULT_MAP_CENTER)
  const [mapLabel, setMapLabel] = useState('Haritadan seçilen nokta')
  const [mapKey, setMapKey] = useState(0)

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
      setErr('Seçilen nokta Türkiye dışında. Yeniden dene.')
      return
    }
    const next: ShoppingLocation = {
      ...place,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    persist({ mode: 'saved', savedId: next.id, places: [...prefs.places, next] })
    setAdding(false)
    setHits([])
    setMsg(`“${next.name}” kaydedildi ve seçildi.`)
    setErr(null)
  }

  function setAddrField<K extends keyof StructuredAddress>(key: K, value: string) {
    setAddr((prev) => ({ ...prev, [key]: value }))
  }

  async function runStructuredSearch() {
    setSearching(true)
    setErr(null)
    setHits([])
    try {
      const province = TURKEY_PROVINCES.find((p) => p.name === addr.province)
      const found = await searchStructuredAddress(addr, province)
      setHits(found)
      if (found.length === 0) {
        setErr('Konum bulunamadı. İlçe/mahalle/sokak bilgisini kontrol et veya haritadan seç.')
      } else if (found[0]) {
        setMapPin({ lat: found[0].lat, lng: found[0].lng })
        setMapLabel(found[0].label)
        setMapKey((k) => k + 1)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Adres araması başarısız')
    } finally {
      setSearching(false)
    }
  }

  async function saveCurrent() {
    const trimmed = name.trim()
    if (!trimmed) {
      setErr('Konuma bir ad ver (ör. Ev, İş).')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const loc = await resolveLiveLocation()
      addPlace({ name: trimmed, lat: loc.lat, lng: loc.lng, label: loc.label })
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
      setMapKey((k) => k + 1)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Konum alınamadı')
    } finally {
      setBusy(false)
    }
  }

  function onProvinceChange(provinceName: string) {
    setAddrField('province', provinceName)
    const province = TURKEY_PROVINCES.find((p) => p.name === provinceName)
    if (province) {
      setMapPin({ lat: province.lat, lng: province.lng })
      setMapKey((k) => k + 1)
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
        İl → ilçe → mahalle → sokak ile ekle; istersen haritadan pin koy. Sonra hesaplamada “Ev”
        seç.
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
              className={addMode === 'form' ? 'active' : ''}
              onClick={() => setAddMode('form')}
            >
              İl / İlçe / Sokak
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

          {addMode === 'form' ? (
            <>
              <label className="field">
                <span>İl *</span>
                <select
                  value={addr.province}
                  onChange={(e) => onProvinceChange(e.target.value)}
                >
                  {TURKEY_PROVINCES.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>İlçe *</span>
                <input
                  value={addr.district}
                  onChange={(e) => setAddrField('district', e.target.value)}
                  placeholder="Örn. Kadıköy"
                />
              </label>
              <label className="field">
                <span>Mahalle</span>
                <input
                  value={addr.neighborhood}
                  onChange={(e) => setAddrField('neighborhood', e.target.value)}
                  placeholder="Örn. Caferağa"
                />
              </label>
              <label className="field">
                <span>Sokak / Cadde</span>
                <input
                  value={addr.street}
                  onChange={(e) => setAddrField('street', e.target.value)}
                  placeholder="Örn. Moda Caddesi"
                />
              </label>
              <label className="field">
                <span>Kapı no</span>
                <input
                  value={addr.buildingNo}
                  onChange={(e) => setAddrField('buildingNo', e.target.value)}
                  placeholder="Örn. 12"
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={searching}
                onClick={() => void runStructuredSearch()}
              >
                {searching ? 'Aranıyor…' : 'Konumu bul'}
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
                resetKey={mapKey}
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
