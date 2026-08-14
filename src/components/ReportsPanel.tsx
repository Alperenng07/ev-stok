import { useMemo } from 'react'
import { useSavings } from '../context/SavingsContext'
import { formatTry } from '../lib/budgetPlanner'
import { entryMissed, entrySaved } from '../lib/savingsStats'
import type { SavingsPeriod } from '../types/savings'

const PERIODS: { id: SavingsPeriod; label: string }[] = [
  { id: 'day', label: 'Bugün' },
  { id: 'week', label: 'Hafta' },
  { id: 'month', label: 'Ay' },
  { id: 'year', label: 'Yıl' },
  { id: 'all', label: 'Tümü' },
]

function TrendBars({ data }: { data: { label: string; amount: number }[] }) {
  const max = Math.max(...data.map((d) => d.amount), 1)
  return (
    <div className="trend-wrap">
      {data.map((d) => {
        const h = Math.max(8, Math.round((d.amount / max) * 96))
        return (
          <div key={d.label} className="trend-col">
            <span className="trend-amount">{d.amount > 0 ? Math.round(d.amount) : ''}</span>
            <div className="trend-track">
              <div className="trend-bar" style={{ height: h }} />
            </div>
            <span className="trend-label">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ReportsPanel() {
  const {
    loading,
    period,
    setPeriod,
    periodEntries,
    periodSavedTotal,
    periodMissedTotal,
    periodTitle,
    trend,
    removeSavings,
  } = useSavings()

  const net = useMemo(
    () => Math.round((periodSavedTotal - periodMissedTotal) * 100) / 100,
    [periodSavedTotal, periodMissedTotal],
  )

  return (
    <section className="panel">
      <h2 className="panel-title">Bilanço</h2>
      <p className="panel-sub">
        Liste’de alındı + market seçince: yapılan tasarruf ve kaçırılan buraya düşer.
      </p>

      <div className="filters" role="tablist" aria-label="Dönem">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            className={period === p.id ? 'active' : ''}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">
          <p>Bilanço yükleniyor…</p>
        </div>
      ) : (
        <>
          <div className="bilanco-hero">
            <span className="hero-eye">{periodTitle}</span>
            <div className="hero-row">
              <div>
                <span className="hero-mini">Yapılan tasarruf</span>
                <strong className="hero-value">+{formatTry(periodSavedTotal)}</strong>
              </div>
              <div>
                <span className="hero-mini">Kaçırılan</span>
                <strong className="hero-value missed">−{formatTry(periodMissedTotal)}</strong>
              </div>
            </div>
            <span className="hero-sub">Net etki: {formatTry(net)}</span>
          </div>

          <h3 className="section-h">Trend (yapılan tasarruf)</h3>
          <div className="trend-card">
            {trend.every((t) => t.amount === 0) ? (
              <div className="banner">Kayıt yok. Hesapla → alındı → market seç.</div>
            ) : (
              <TrendBars data={trend} />
            )}
          </div>

          <h3 className="section-h">Kayıtlar</h3>
          {periodEntries.length === 0 ? (
            <div className="empty-card">
              <strong>Henüz bilanço yok</strong>
              <p>1) Hesapla 2) Ürünü alındı yap 3) Market seç</p>
            </div>
          ) : (
            periodEntries.map((entry) => {
              const saved = entrySaved(entry)
              const missed = entryMissed(entry)
              return (
                <div key={entry.id} className="entry-row">
                  <div className="entry-main">
                    <strong>{entry.itemName}</strong>
                    <small>
                      {entry.placeLabel} · {new Date(entry.createdAt).toLocaleString('tr-TR')}
                    </small>
                    <small>
                      Ödenen {formatTry(entry.paidUnitPrice)}
                      {entry.maxUnitPrice
                        ? ` · max ${formatTry(entry.maxUnitPrice)} · min ${formatTry(entry.minUnitPrice)}`
                        : ''}
                    </small>
                  </div>
                  <div className="entry-side">
                    {saved > 0 ? <span className="entry-saved">+{formatTry(saved)}</span> : null}
                    {missed > 0 ? <span className="entry-missed">−{formatTry(missed)}</span> : null}
                    <button
                      type="button"
                      className="btn-chip danger-text"
                      onClick={() => {
                        if (window.confirm(`${entry.itemName} bilanço kaydı silinsin mi?`)) {
                          void removeSavings(entry.id)
                        }
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </>
      )}
    </section>
  )
}
