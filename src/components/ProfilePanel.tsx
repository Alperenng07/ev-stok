import { useEffect, useState } from 'react'
import type { LocalProfile } from '../lib/supabase'
import type { Household } from '../types'

type Props = {
  profile: LocalProfile
  household: Household | null
  onSave: (profile: LocalProfile) => Promise<void>
}

export function ProfilePanel({ profile, household, onSave }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [email, setEmail] = useState(profile.email)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayName(profile.displayName)
    setEmail(profile.email)
  }, [profile.displayName, profile.email])

  const dirty =
    displayName.trim() !== profile.displayName ||
    email.trim().toLowerCase() !== profile.email.toLowerCase()

  async function save() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await onSave({ displayName: displayName.trim(), email: email.trim() })
      setMessage('Profil güncellendi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Profil</h2>
      <p className="panel-sub">Adını ve e-posta adresini düzenleyebilirsin.</p>

      <div className="info-card">
        <label className="field">
          <span>Ad</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Adın"
          />
        </label>
        <label className="field">
          <span>E-posta</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@mail.com"
          />
        </label>
        <span className="label">Aile</span>
        <strong className="value">{household?.name ?? '—'}</strong>

        {message ? <div className="banner ok">{message}</div> : null}
        {error ? <div className="banner err">{error}</div> : null}

        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty || saving}
          onClick={() => void save()}
        >
          {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
        </button>
      </div>

      <div className="banner">
        Profil bu cihazda saklanır ve aile üye listesinde görünür (migration sonrası).
      </div>
    </section>
  )
}
