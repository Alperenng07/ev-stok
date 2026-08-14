import { useState } from 'react'
import type { Household, HouseholdMember } from '../types'

type Props = {
  active: Household
  members: HouseholdMember[]
  userId: string | null
  myRole: 'owner' | 'member' | null
  onRemoveMember: (userId: string) => Promise<void>
  onLeaveFamily: () => Promise<void>
  onCreateRequest: () => void
  onJoinRequest: () => void
  onMailsRequest: () => void
  onLeaveDevice: () => void
}

export function FamilyPanel({
  active,
  members,
  userId,
  myRole,
  onRemoveMember,
  onLeaveFamily,
  onCreateRequest,
  onJoinRequest,
  onMailsRequest,
  onLeaveDevice,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(active.inviteCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Davet kodunu kopyala:', active.inviteCode)
    }
  }

  async function kick(member: HouseholdMember) {
    if (!window.confirm(`${member.displayName} aileden çıkarılsın mı?`)) return
    setBusyId(member.userId)
    setError(null)
    try {
      await onRemoveMember(member.userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Çıkarılamadı')
    } finally {
      setBusyId(null)
    }
  }

  async function leave() {
    if (!window.confirm('Bu aileden ayrılmak istediğine emin misin?')) return
    setBusyId(userId ?? 'self')
    setError(null)
    try {
      await onLeaveFamily()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ayrılamadı')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Aile</h2>
      <p className="panel-sub">
        Davet kodunu paylaş. Kurucu yanlış katılanları çıkarabilir; herkes aileden ayrılabilir.
      </p>

      <div className="info-card">
        <span className="label">Aile adı</span>
        <strong className="value">{active.name}</strong>
        <span className="label" style={{ marginTop: 14 }}>
          Davet kodu
        </span>
        <button type="button" className="code-box" onClick={() => void copyCode()}>
          <span className="code">{active.inviteCode}</span>
          <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
        </button>
      </div>

      {error ? <div className="banner err">{error}</div> : null}

      <h3 className="section-h">Üyeler ({members.length})</h3>
      {members.length === 0 ? (
        <div className="banner warn">
          Üye listesi boş. Supabase’de migration_mobile_features.sql dosyasını çalıştırın.
        </div>
      ) : (
        members.map((m) => {
          const isMe = m.userId === userId
          const canKick = myRole === 'owner' && !isMe && m.role !== 'owner'
          return (
            <div key={`${m.householdId}-${m.userId}`} className="member-row">
              <div>
                <strong>
                  {m.displayName}
                  {isMe ? ' (sen)' : ''}
                </strong>
                <small>{m.email || '—'}</small>
              </div>
              <div className="member-right">
                <span className="role">{m.role === 'owner' ? 'Kurucu' : 'Üye'}</span>
                {canKick ? (
                  <button
                    type="button"
                    className="kick-btn"
                    disabled={busyId === m.userId}
                    onClick={() => void kick(m)}
                  >
                    {busyId === m.userId ? '…' : 'Çıkar'}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })
      )}

      <div className="family-actions">
        <button type="button" className="btn btn-secondary" onClick={onCreateRequest}>
          Yeni aile oluştur
        </button>
        <button type="button" className="btn btn-secondary" onClick={onJoinRequest}>
          Başka aileye katıl
        </button>
        <button type="button" className="btn btn-secondary" onClick={onMailsRequest}>
          Hatırlatma mailleri
        </button>
        <button type="button" className="btn btn-secondary" onClick={onLeaveDevice}>
          Bu cihazdan çık
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busyId === userId}
          onClick={() => void leave()}
        >
          Aileden ayrıl
        </button>
      </div>
    </section>
  )
}
