import { useState } from 'react'
import {
  googleMapsOpenUrl,
  resolveMapsLinkToPlace,
} from '../lib/googleMapsLink'
import { isValidTurkeyCoord } from '../lib/geocode'
import { LocationError, resolveLiveLocation } from '../lib/location'
import { locationPrefsStore } from '../lib/locationPrefsStore'
import {
  getLocationPermissionGuide,
  tryOpenBrowserLocationSettings,
} from '../lib/permissionHelp'
import type { LocationPreference, ShoppingLocation } from '../types/location'
import { LocationMapFrame } from './LocationMapFrame'

type Props = {
  prefs: LocationPreference
  onChange: (prefs: LocationPreference) => void
}

type AddMode = 'google' | 'map' | 'gps'

export function LocationPicker({ prefs, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [addMode, setAddMode] = useState<AddMode>('google')
  const [name, setName] = useState('Ev')
  const [mapsLink, setMapsLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showPermissionHelp, setShowPermissionHelp] = useState(false)
  const [mapPin, setMapPin] = useState({ lat: 41.0082, lng: 28.9784 })
  const [mapLabel, setMapLabel] = useState('Haritadan seçilen nokta')
  const [mapKey, setMapKey] = useState(0)

  const permissionGuide = getLocationPermissionGuide()

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
    persist({ places, savedId, mode: savedId ? 'saved' : 'live' })
  }

  function addPlace(place: Omit<ShoppingLocation, 'id' | 'createdAt'>) {
    if (!isValidTurkeyCoord(place.lat, place.lng)) {
      setErr('Seçilen nokta Türkiye dışında.')
      return
    }
    const next: ShoppingLocation = {
      ...place,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    persist({ mode: 'saved', savedId: next.id, places: [...prefs.places, next] })
    setAdding(false)
    setMapsLink('')
    setMsg(`“${next.name}” kaydedildi ve seçildi.`)
    setErr(null)
    setShowPermissionHelp(false)
  }

  async function saveFromGoogleLink() {
    const trimmedName = name.trim() || 'Ev'
    setBusy(true)
    setErr(null)
    setShowPermissionHelp(false)
    try {
      const place = await resolveMapsLinkToPlace(mapsLink)
      addPlace({
        name: trimmedName,
        lat: place.lat,
        lng: place.lng,
        label: place.label,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Link okunamadı')
    } finally {
      setBusy(false)
    }
  }

  async function saveCurrent() {
    const trimmedName = name.trim() || 'Ev'
    setBusy(true)
    setErr(null)
    setShowPermissionHelp(false)
    try {
      const loc = await resolveLiveLocation()
      addPlace({
        name: trimmedName,
        lat: loc.lat,
        lng: loc.lng,
        label: loc.label,
      })
    } catch (e) {
      if (e instanceof LocationError && e.code === 'permission') {
        setShowPermissionHelp(true)
      }
      setErr(e instanceof Error ? e.message : 'Konum alınamadı')
    } finally {
      setBusy(false)
    }
  }

  function saveMapPin() {
    addPlace({
      name: name.trim() || 'Harita konumu',
      lat: mapPin.lat,
      lng: mapPin.lng,
      label: mapLabel || `${mapPin.lat.toFixed(5)}, ${mapPin.lng.toFixed(5)}`,
    })
  }

  async function centerMapOnGps() {
    setBusy(true)
    setErr(null)
    setShowPermissionHelp(false)
    try {
      const loc = await resolveLiveLocation()
      setMapPin({ lat: loc.lat, lng: loc.lng })
      setMapLabel(loc.label)
      setMapKey((k) => k + 1)
    } catch (e) {
      if (e instanceof LocationError && e.code === 'permission') {
        setShowPermissionHelp(true)
      }
      setErr(e instanceof Error ? e.message : 'Konum alınamadı')
    } finally {
      setBusy(false)
    }
  }

  function openGoogleMaps() {
    window.open(googleMapsOpenUrl(), '_blank', 'noopener,noreferrer')
  }

  function openPermissionSettings() {
    const opened = tryOpenBrowserLocationSettings(permissionGuide.settingsUrl)
    if (!opened) {
      setErr(
        'Tarayıcı güvenlik nedeniyle ayar sayfasını otomatik açamadı. Adres çubuğundaki kilit simgesinden Konum iznini aç.',
      )
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
            setShowPermissionHelp(false)
          }}
        >
          {adding ? 'Kapat' : '+ Konum ekle'}
        </button>
      </div>
      <p className="loc-hint">
        En güvenlisi: Google Maps’te pin koy → Paylaş → linki yapıştır. İşteyken eve göre hesaplamak
        için “Ev” seç.
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
        <div className="banner">Hesaplama anlık GPS ile yapılır (izin gerekir).</div>
      )}

      {msg ? <div className="banner ok">{msg}</div> : null}
      {err ? <div className="banner err">{err}</div> : null}

      {showPermissionHelp ? (
        <div className="loc-perm">
          <strong>{permissionGuide.title}</strong>
          <ol>
            {permissionGuide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {permissionGuide.settingsLabel ? (
            <button type="button" className="btn btn-secondary" onClick={openPermissionSettings}>
              {permissionGuide.settingsLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void saveCurrent()}
          >
            İzin verdim, tekrar dene
          </button>
        </div>
      ) : null}

      {adding ? (
        <div className="loc-add">
          <label className="field">
            <span>Konum adı</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ev, İş…"
            />
          </label>

          <div className="filters loc-chips" role="tablist" aria-label="Ekleme yöntemi">
            <button
              type="button"
              className={addMode === 'google' ? 'active' : ''}
              onClick={() => setAddMode('google')}
            >
              Google Maps
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

          {addMode === 'google' ? (
            <>
              <div className="banner ok">
                1) Google Maps’i aç → pin koy veya yer ara
                <br />
                2) Paylaş → bağlantıyı kopyala
                <br />
                3) Buraya yapıştır → Kaydet
                <br />
                <small>
                  Kısa link (maps.app.goo.gl) olursa: önce tarayıcıda aç, adres çubuğundaki uzun
                  URL’yi kopyala.
                </small>
              </div>
              <button type="button" className="btn btn-secondary" onClick={openGoogleMaps}>
                Google Maps’te pin koy
              </button>
              <label className="field">
                <span>Google Maps linki</span>
                <textarea
                  rows={3}
                  value={mapsLink}
                  onChange={(e) => setMapsLink(e.target.value)}
                  placeholder="https://www.google.com/maps/place/…/@41.01,28.97… veya 41.01, 28.97"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !mapsLink.trim()}
                onClick={() => void saveFromGoogleLink()}
              >
                {busy ? 'Okunuyor…' : 'Linkten kaydet'}
              </button>
            </>
          ) : null}

          {addMode === 'map' ? (
            <>
              <p className="loc-hint">
                Bu OpenStreetMap haritasıdır (API anahtarı gerekmez). Google pin için “Google Maps”
                sekmesini kullan.
              </p>
              <LocationMapFrame
                lat={mapPin.lat}
                lng={mapPin.lng}
                resetKey={mapKey}
                onPick={(coords) => {
                  setMapPin(coords)
                  setMapLabel(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
                }}
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
