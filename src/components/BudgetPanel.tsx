import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LocationPicker } from './LocationPicker'
import { useBudgetCache } from '../context/BudgetCacheContext'
import { buildLiveBudgetPlans, formatTry } from '../lib/budgetPlanner'
import { chainById } from '../lib/chains'
import { resolveBudgetLocation } from '../lib/location'
import { locationPrefsStore } from '../lib/locationPrefsStore'
import type { StockItem } from '../types'
import type { BudgetPlan, BudgetResult } from '../types/budget'
import type { LocationPreference } from '../types/location'

type Props = {
  items: StockItem[]
  autostart?: boolean
  onAutostartConsumed?: () => void
}

export function BudgetPanel({ items, autostart, onAutostartConsumed }: Props) {
  const { result: cached, setResult: setCache, hasCache, calculatedAt } = useBudgetCache()
  const pending = useMemo(() => items.filter((i) => !i.purchased), [items])

  const [locPrefs, setLocPrefs] = useState<LocationPreference>(() => locationPrefsStore.load())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BudgetResult | null>(cached)
  const [selectedId, setSelectedId] = useState<string | null>(cached?.plans[0]?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const autoStarted = useRef(false)

  const selected: BudgetPlan | null =
    result?.plans.find((p) => p.id === selectedId) ?? result?.plans[0] ?? null

  const runPlanner = useCallback(async () => {
    if (pending.length === 0) {
      setError('Alınacak ürün yok. Önce listeye ürün ekle.')
      setResult(null)
      setCache(null)
      return
    }
    setLoading(true)
    setError(null)
    setStatus(
      locPrefs.mode === 'saved'
        ? 'Kayıtlı konum yükleniyor…'
        : 'Anlık konum alınıyor…',
    )
    try {
      const loc = await resolveBudgetLocation(locPrefs)
      setStatus(
        `Konum: ${loc.label} — marketfiyati.org.tr’den ${pending.length} ürün için canlı fiyat çekiliyor…`,
      )
      const next = await buildLiveBudgetPlans({
        pendingItems: pending,
        latitude: loc.lat,
        longitude: loc.lng,
        locationLabel: loc.label,
        distanceKm: 5,
      })
      setResult(next)
      setCache(next)
      setSelectedId(next.plans[0]?.id ?? null)
      setStatus(null)
      if (next.plans.length === 0) {
        setError('Yakındaki marketlerde bu ürünler için fiyat bulunamadı.')
      }
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Plan oluşturulamadı')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [pending, setCache, locPrefs])

  useEffect(() => {
    if (autostart && !autoStarted.current && !loading) {
      autoStarted.current = true
      void runPlanner()
      onAutostartConsumed?.()
    }
  }, [autostart, loading, runPlanner, onAutostartConsumed])

  useEffect(() => {
    if (cached && !result) {
      setResult(cached)
      setSelectedId(cached.plans[0]?.id ?? null)
    }
  }, [cached, result])

  return (
    <section className="panel">
      <h2 className="panel-title">Bütçe planı</h2>
      <p className="panel-sub">
        Bir kez hesapla; listeden ürünü “Alındı” yapıp market seçince tasarruf bilançoya yazılır.
      </p>

      <LocationPicker prefs={locPrefs} onChange={setLocPrefs} />

      <div className="panel-row">
        <span className="meta">{pending.length} alınacak ürün</span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={() => void runPlanner()}
        >
          {loading ? 'Hesaplanıyor…' : hasCache ? 'Tekrar hesapla' : 'Canlı planları hesapla'}
        </button>
      </div>

      {hasCache && calculatedAt ? (
        <div className="banner ok">
          Son hesap hazır ({new Date(calculatedAt).toLocaleTimeString('tr-TR')}). Listeye dönüp
          alındı + market seçebilirsin.
        </div>
      ) : (
        <div className="banner warn">
          Önce buradan hesapla. Hesap yokken alınan ürünler bilançoya fiyat yansıtmaz.
        </div>
      )}

      {status ? <div className="banner ok">{status}</div> : null}
      {error ? <div className="banner err">{error}</div> : null}

      {result ? (
        <div className="budget-body">
          <div className="banner ok">
            Konum: {result.locationLabel} ({result.location.lat.toFixed(4)},{' '}
            {result.location.lng.toFixed(4)})
          </div>
          <div className="banner">{result.disclaimer}</div>

          {result.potentialSaving > 0 ? (
            <div className="saving-card">
              <span className="saving-label">Potansiyel tasarruf</span>
              <strong className="saving-value">{formatTry(result.potentialSaving)} kar edebilirsin</strong>
              <span className="saving-hint">
                En pahalı tek-zincire göre ({formatTry(result.worstSingleTotal)}) en ucuz plan (
                {formatTry(result.bestTotal)}).
              </span>
            </div>
          ) : null}

          <h3 className="section-h">Önerilen planlar</h3>
          {result.plans.map((plan) => {
            const active = selected?.id === plan.id
            const chainColor = plan.chainId ? chainById(plan.chainId).color : 'var(--moss)'
            return (
              <button
                key={plan.id}
                type="button"
                className={`plan-card${active ? ' active' : ''}`}
                onClick={() => setSelectedId(plan.id)}
              >
                <span className="plan-dot" style={{ background: chainColor }} />
                <span className="plan-main">
                  <strong>{plan.title}</strong>
                  <small>{plan.subtitle}</small>
                  <small>
                    {plan.availableCount} var
                    {plan.missingCount ? ` · ${plan.missingCount} yok` : ' · hepsi tamam'}
                  </small>
                </span>
                <strong className="plan-total">{formatTry(plan.total)}</strong>
              </button>
            )
          })}

          {selected ? (
            <>
              <h3 className="section-h">Bu planda var ({selected.availableCount})</h3>
              {selected.lines.map((line) => (
                <div key={`${selected.id}-ok-${line.itemId}`} className="budget-line">
                  <span className="badge ok">Var</span>
                  <div className="budget-line-main">
                    <strong>
                      {line.itemName} × {line.qty} {line.unit}
                    </strong>
                    {line.catalogName ? <small>Eşleşen: {line.catalogName}</small> : null}
                    <small>
                      {line.chainName} · {line.storeName} · {formatTry(line.unitPrice)}
                    </small>
                  </div>
                  <strong>{formatTry(line.lineTotal)}</strong>
                </div>
              ))}

              {selected.missingCount > 0 ? (
                <>
                  <h3 className="section-h">Bu planda yok ({selected.missingCount})</h3>
                  {selected.missingItems.map((miss) => (
                    <div key={`${selected.id}-miss-${miss.itemId}`} className="budget-line miss">
                      <span className="badge warn">Yok</span>
                      <div className="budget-line-main">
                        <strong>
                          {miss.itemName} × {miss.qty} {miss.unit}
                        </strong>
                        {miss.alternative ? (
                          <small>
                            Alternatif: {miss.alternative.chainName} ·{' '}
                            {formatTry(miss.alternative.unitPrice)}
                          </small>
                        ) : (
                          <small>Yakında alternatif bulunamadı</small>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
