import { useState, type FormEvent } from 'react'

type Props = {
  error: string | null
  initialMode?: 'choose' | 'create' | 'join'
  allowCancel?: boolean
  onCancel?: () => void
  onCreate: (name: string) => Promise<unknown>
  onJoin: (code: string) => Promise<unknown>
}

export function HouseholdGate({
  error,
  initialMode = 'choose',
  allowCancel = false,
  onCancel,
  onCreate,
  onJoin,
}: Props) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(initialMode)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setLocalError(null)
    try {
      await onCreate(name)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Oluşturulamadı')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setLocalError(null)
    try {
      await onJoin(code)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Katılınamadı')
    } finally {
      setBusy(false)
    }
  }

  const msg = localError || error

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden />
      <header className="top">
        <div className="brand-block">
          <p className="brand">Ev Stok</p>
          <p className="tagline">Her aile kendi listesini görür</p>
        </div>
      </header>

      <section className="gate">
        {mode === 'choose' ? (
          <>
            <h1>Ailene katıl veya yeni aile kur</h1>
            <p className="gate-lead">
              Arkadaşların kendi ailelerini oluşturur. Davet koduyla sadece kendi listenizi
              paylaşırsınız.
            </p>
            <div className="gate-actions">
              <button type="button" className="btn btn-primary" onClick={() => setMode('create')}>
                Yeni aile oluştur
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setMode('join')}>
                Davet kodu ile katıl
              </button>
            </div>
            <p className="gate-hint">
              Mevcut listeniz için kod: <strong>TURKSOYS</strong>
            </p>
          </>
        ) : null}

        {mode === 'create' ? (
          <form className="gate-form" onSubmit={handleCreate}>
            <button
              type="button"
              className="linkish"
              onClick={() => (allowCancel && onCancel ? onCancel() : setMode('choose'))}
            >
              ← Geri
            </button>
            <h1>Yeni aile</h1>
            <label className="field">
              <span>Aile adı</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Demir Ailesi"
                required
                minLength={2}
                autoFocus
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Oluşturuluyor…' : 'Oluştur ve devam et'}
            </button>
          </form>
        ) : null}

        {mode === 'join' ? (
          <form className="gate-form" onSubmit={handleJoin}>
            <button
              type="button"
              className="linkish"
              onClick={() => (allowCancel && onCancel ? onCancel() : setMode('choose'))}
            >
              ← Geri
            </button>
            <h1>Davet kodu</h1>
            <label className="field">
              <span>6 haneli kod</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Örn. TURKSOYS"
                required
                minLength={4}
                maxLength={12}
                autoFocus
                autoCapitalize="characters"
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Katılınuyor…' : 'Aileme katıl'}
            </button>
          </form>
        ) : null}

        {msg ? <p className="banner err">{msg}</p> : null}
      </section>
    </div>
  )
}
