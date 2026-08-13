import { useState } from 'react'
import type { Household } from '../types'

type Props = {
  active: Household
  households: Household[]
  onSelect: (h: Household) => void
  onLeave: () => void
  onCreateRequest: () => void
  onJoinRequest: () => void
  onMailsRequest: () => void
}

export function FamilyBar({
  active,
  households,
  onSelect,
  onLeave,
  onCreateRequest,
  onJoinRequest,
  onMailsRequest,
}: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(active.inviteCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Davet kodunu kopyala:', active.inviteCode)
    }
  }

  return (
    <div className="family-bar">
      <button type="button" className="family-main" onClick={() => setOpen((v) => !v)}>
        <span className="family-name">{active.name}</span>
        <span className="family-code">{active.inviteCode}</span>
      </button>
      <button type="button" className="btn-chip" onClick={() => void copyCode()}>
        {copied ? 'Kopyalandı' : 'Kodu kopyala'}
      </button>

      {open ? (
        <div className="family-menu">
          {households.length > 1 ? (
            <div className="family-switch">
              <p>Aile değiştir</p>
              {households.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className={h.id === active.id ? 'active' : ''}
                  onClick={() => {
                    onSelect(h)
                    setOpen(false)
                  }}
                >
                  {h.name}
                  <small>{h.inviteCode}</small>
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onCreateRequest()
            }}
          >
            Yeni aile oluştur
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onJoinRequest()
            }}
          >
            Başka aileye katıl
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onMailsRequest()
            }}
          >
            Hatırlatma mailleri
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              setOpen(false)
              onLeave()
            }}
          >
            Bu cihazdan çık
          </button>
        </div>
      ) : null}
    </div>
  )
}
