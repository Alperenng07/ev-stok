import { useEffect, useState, type FormEvent } from 'react'
import {
  addReminderEmail,
  listReminderEmails,
  removeReminderEmail,
  type ReminderEmail,
} from '../lib/supabase'

type Props = {
  open: boolean
  householdId: string
  householdName: string
  onClose: () => void
}

export function ReminderMailsSheet({
  open,
  householdId,
  householdName,
  onClose,
}: Props) {
  const [emails, setEmails] = useState<ReminderEmail[]>([])
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    void listReminderEmails(householdId)
      .then(setEmails)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Mailler yüklenemedi'),
      )
  }, [open, householdId])

  if (!open) return null

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await addReminderEmail(householdId, value)
      setValue('')
      setEmails(await listReminderEmails(householdId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eklenemedi')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    setBusy(true)
    setError(null)
    try {
      await removeReminderEmail(id)
      setEmails(await listReminderEmails(householdId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silinemedi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden />
        <header className="sheet-head">
          <h2>Hatırlatma mailleri</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </header>

        <p className="mail-help">
          <strong>{householdName}</strong> için günlük hatırlatmalar bu adreslere, uygulama
          sahibinin Gmail’inden gider (15:30 ekle / 17:30 al).
        </p>

        <ul className="mail-list">
          {emails.length === 0 ? (
            <li className="muted">Henüz mail eklenmedi.</li>
          ) : (
            emails.map((row) => (
              <li key={row.id}>
                <span>{row.email}</span>
                <button
                  type="button"
                  className="linkish danger"
                  disabled={busy}
                  onClick={() => void handleRemove(row.id)}
                >
                  Sil
                </button>
              </li>
            ))
          )}
        </ul>

        <form className="form" onSubmit={(e) => void handleAdd(e)}>
          <label className="field">
            <span>E-posta ekle</span>
            <input
              type="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="ornek@gmail.com"
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Ekle'}
          </button>
        </form>

        {error ? <p className="banner err">{error}</p> : null}
      </div>
    </div>
  )
}
