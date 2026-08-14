import { useEffect, useMemo, useState } from 'react'
import {
  formatAddressLabel,
  isValidTurkeyCoord,
  searchStreetSuggestions,
  searchStructuredAddress,
  type StructuredAddress,
} from '../lib/geocode'
import { LocationError, resolveLiveLocation } from '../lib/location'
import { locationPrefsStore } from '../lib/locationPrefsStore'
import {
  getLocationPermissionGuide,
  tryOpenBrowserLocationSettings,
} from '../lib/permissionHelp'
import {
  filterByName,
  listDistricts,
  listNeighborhoods,
  listProvinces,
  type AdminPlace,
} from '../lib/turkiyeApi'
import type { GeocodeHit, LocationPreference, ShoppingLocation } from '../types/location'

type Props = {
  prefs: LocationPreference
  onChange: (prefs: LocationPreference) => void
}

type AddMode = 'address' | 'gps'

export function LocationPicker({ prefs, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [addMode, setAddMode] = useState<AddMode>('address')
  const [name, setName] = useState('Ev')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showPermissionHelp, setShowPermissionHelp] = useState(false)

  const [provinces, setProvinces] = useState<AdminPlace[]>([])
  const [districts, setDistricts] = useState<AdminPlace[]>([])
  const [neighborhoods, setNeighborhoods] = useState<AdminPlace[]>([])
  const [listsBusy, setListsBusy] = useState(false)

  const [provinceId, setProvinceId] = useState<number | null>(null)
  const [districtId, setDistrictId] = useState<number | null>(null)
  const [neighborhoodId, setNeighborhoodId] = useState<number | null>(null)
  const [neighborhoodQuery, setNeighborhoodQuery] = useState('')
  const [street, setStreet] = useState('')
  const [buildingNo, setBuildingNo] = useState('')
  const [apartment, setApartment] = useState('')

  const [streetHits, setStreetHits] = useState<GeocodeHit[]>([])
  const [resolveHits, setResolveHits] = useState<GeocodeHit[]>([])

  const permissionGuide = getLocationPermissionGuide()

  const province = provinces.find((p) => p.id === provinceId) ?? null
  const district = districts.find((d) => d.id === districtId) ?? null
  const neighborhood = neighborhoods.find((n) => n.id === neighborhoodId) ?? null

  const filteredNeighborhoods = useMemo(
    () => filterByName(neighborhoods, neighborhoodQuery, 50),
    [neighborhoods, neighborhoodQuery],
  )

  const bias = useMemo(() => {
    if (province?.latitude != null && province?.longitude != null) {
      return { lat: province.latitude, lng: province.longitude }
    }
    return undefined
  }, [province])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await listProvinces()
        if (!cancelled) setProvinces(list)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'İller yüklenemedi')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (provinceId == null) {
      setDistricts([])
      return
    }
    let cancelled = false
    setListsBusy(true)
    void (async () => {
      try {
        const list = await listDistricts(provinceId)
        if (!cancelled) setDistricts(list)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'İlçeler yüklenemedi')
      } finally {
        if (!cancelled) setListsBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [provinceId])

  useEffect(() => {
    if (districtId == null) {
      setNeighborhoods([])
      return
    }
    let cancelled = false
    setListsBusy(true)
    void (async () => {
      try {
        const list = await listNeighborhoods(districtId)
        if (!cancelled) setNeighborhoods(list)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Mahalleler yüklenemedi')
      } finally {
        if (!cancelled) setListsBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [districtId])

  useEffect(() => {
    if (!province || !district || street.trim().length < 2) {
      setStreetHits([])
      return
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const hits = await searchStreetSuggestions(
            street,
            {
              province: province.name,
              district: district.name,
              neighborhood: neighborhood?.name ?? neighborhoodQuery,
            },
            bias,
          )
          setStreetHits(hits)
        } catch {
          setStreetHits([])
        }
      })()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [street, province, district, neighborhood, neighborhoodQuery, bias])

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

  function resetAddressForm() {
    setProvinceId(null)
    setDistrictId(null)
    setNeighborhoodId(null)
    setNeighborhoodQuery('')
    setStreet('')
    setBuildingNo('')
    setApartment('')
    setStreetHits([])
    setResolveHits([])
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
    resetAddressForm()
    setMsg(`“${next.name}” kaydedildi ve seçildi.`)
    setErr(null)
    setShowPermissionHelp(false)
  }

  function currentParts(streetOverride?: string): StructuredAddress | null {
    if (!province || !district) return null
    const mahalle = neighborhood?.name || neighborhoodQuery.trim()
    if (!mahalle) return null
    const streetValue = (streetOverride ?? street).trim()
    if (!streetValue) return null
    return {
      province: province.name,
      district: district.name,
      neighborhood: mahalle,
      street: streetValue,
      buildingNo: buildingNo.trim(),
      apartment: apartment.trim(),
    }
  }

  async function findAndSave(hit?: GeocodeHit) {
    const parts = currentParts(hit?.name)
    if (!parts) {
      setErr('İl, ilçe, mahalle ve sokak seç/yaz.')
      return
    }
    setBusy(true)
    setErr(null)
    setShowPermissionHelp(false)
    try {
      if (hit) {
        addPlace({
          name: name.trim() || 'Ev',
          lat: hit.lat,
          lng: hit.lng,
          label: formatAddressLabel(parts),
        })
        return
      }
      const hits = await searchStructuredAddress(parts, bias)
      if (hits.length === 0) {
        setErr('Bu adres bulunamadı. Sokak/No’yu kontrol edip tekrar dene.')
        setResolveHits([])
        return
      }
      if (hits.length === 1) {
        addPlace({
          name: name.trim() || 'Ev',
          lat: hits[0].lat,
          lng: hits[0].lng,
          label: formatAddressLabel(parts),
        })
        return
      }
      setResolveHits(hits)
      setMsg('Birden fazla sonuç var — listeden doğru olanı seç.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Adres bulunamadı')
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

  function openPermissionSettings() {
    const opened = tryOpenBrowserLocationSettings(permissionGuide.settingsUrl)
    if (!opened) {
      setErr(
        'Tarayıcı güvenlik nedeniyle ayar sayfasını otomatik açamadı. Adres çubuğundaki kilit simgesinden Konum iznini aç.',
      )
    }
  }

  const selected = prefs.places.find((p) => p.id === prefs.savedId)
  const canResolve = Boolean(province && district && (neighborhood || neighborhoodQuery.trim()) && street.trim())

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
            setResolveHits([])
          }}
        >
          {adding ? 'Kapat' : '+ Konum ekle'}
        </button>
      </div>
      <p className="loc-hint">
        İl → ilçe → mahalle → sokak → no → daire seçerek kaydet. Listeler Türkiye adres verisinden
        gelir; sokak önerileri otomatik bulunur.
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ev, İş…" />
          </label>

          <div className="filters loc-chips" role="tablist" aria-label="Ekleme yöntemi">
            <button
              type="button"
              className={addMode === 'address' ? 'active' : ''}
              onClick={() => setAddMode('address')}
            >
              Adres seç
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
                <span>İl</span>
                <select
                  value={provinceId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null
                    setProvinceId(id)
                    setDistrictId(null)
                    setNeighborhoodId(null)
                    setNeighborhoodQuery('')
                    setStreetHits([])
                    setResolveHits([])
                  }}
                >
                  <option value="">İl seç…</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>İlçe</span>
                <select
                  value={districtId ?? ''}
                  disabled={provinceId == null || listsBusy}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null
                    setDistrictId(id)
                    setNeighborhoodId(null)
                    setNeighborhoodQuery('')
                    setStreetHits([])
                    setResolveHits([])
                  }}
                >
                  <option value="">{provinceId == null ? 'Önce il seç' : 'İlçe seç…'}</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Mahalle</span>
                <input
                  value={neighborhoodQuery}
                  disabled={districtId == null}
                  onChange={(e) => {
                    setNeighborhoodQuery(e.target.value)
                    setNeighborhoodId(null)
                    setResolveHits([])
                  }}
                  placeholder={districtId == null ? 'Önce ilçe seç' : 'Mahalle ara / yaz'}
                />
              </label>
              {districtId != null && filteredNeighborhoods.length > 0 ? (
                <div className="loc-hits">
                  {filteredNeighborhoods.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`loc-hit${neighborhoodId === n.id ? ' active' : ''}`}
                      onClick={() => {
                        setNeighborhoodId(n.id)
                        setNeighborhoodQuery(n.name)
                        setResolveHits([])
                      }}
                    >
                      <strong>{n.name}</strong>
                      <small>Mahalle</small>
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="field">
                <span>Sokak / Cadde</span>
                <input
                  value={street}
                  disabled={!province || !district}
                  onChange={(e) => {
                    setStreet(e.target.value)
                    setResolveHits([])
                  }}
                  placeholder="Örn. Atatürk Cad. / Gül Sk."
                />
              </label>
              {streetHits.length > 0 ? (
                <div className="loc-hits">
                  {streetHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      className="loc-hit"
                      onClick={() => {
                        setStreet(hit.name)
                        setStreetHits([])
                        void findAndSave(hit)
                      }}
                    >
                      <strong>{hit.name}</strong>
                      <small>{hit.label}</small>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="loc-row-2">
                <label className="field">
                  <span>Kapı no</span>
                  <input
                    value={buildingNo}
                    onChange={(e) => setBuildingNo(e.target.value)}
                    placeholder="12"
                  />
                </label>
                <label className="field">
                  <span>Daire</span>
                  <input
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    placeholder="5"
                  />
                </label>
              </div>

              {resolveHits.length > 0 ? (
                <div className="loc-hits">
                  {resolveHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      className="loc-hit"
                      onClick={() => void findAndSave(hit)}
                    >
                      <strong>{hit.name}</strong>
                      <small>{hit.label}</small>
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !canResolve}
                onClick={() => void findAndSave()}
              >
                {busy ? 'Bulunuyor…' : 'Konumu bul ve kaydet'}
              </button>
              {listsBusy ? <p className="loc-hint">Listeler yükleniyor…</p> : null}
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
