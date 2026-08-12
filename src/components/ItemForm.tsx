import { useEffect, useId, useState, type FormEvent } from 'react'
import { todayISO } from '../lib/date'
import type { ItemDraft, StockItem } from '../types'

const UNITS = ['adet', 'paket', 'lt', 'kg', 'kutu', 'şişe']

type Props = {
  open: boolean
  initial?: StockItem | null
  onClose: () => void
  onSubmit: (draft: ItemDraft) => void
  onDelete?: () => void
}

function toDraft(item?: StockItem | null): ItemDraft {
  if (item) {
    return {
      name: item.name,
      neededQty: item.neededQty,
      currentQty: item.currentQty,
      unit: item.unit,
      dueDate: item.dueDate,
      renewalDays: item.renewalDays,
      notes: item.notes,
    }
  }
  return {
    name: '',
    neededQty: 1,
    currentQty: 0,
    unit: 'adet',
    dueDate: todayISO(),
    renewalDays: 14,
    notes: '',
  }
}

export function ItemForm({ open, initial, onClose, onSubmit, onDelete }: Props) {
  const titleId = useId()
  const [draft, setDraft] = useState<ItemDraft>(() => toDraft(initial))

  useEffect(() => {
    if (open) setDraft(toDraft(initial))
  }, [open, initial])

  if (!open) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return
    onSubmit({
      ...draft,
      neededQty: Math.max(0, Number(draft.neededQty) || 0),
      currentQty: Math.max(0, Number(draft.currentQty) || 0),
      renewalDays:
        draft.renewalDays === null || draft.renewalDays === 0
          ? null
          : Math.max(1, Number(draft.renewalDays) || 1),
    })
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden />
        <header className="sheet-head">
          <h2 id={titleId}>{initial ? 'Ürünü düzenle' : 'Yeni ürün'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Ürün adı</span>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Örn. Süt"
              required
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Alınacak</span>
              <input
                type="number"
                min={0}
                step="any"
                value={draft.neededQty}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, neededQty: Number(e.target.value) }))
                }
              />
            </label>
            <label className="field">
              <span>Mevcut</span>
              <input
                type="number"
                min={0}
                step="any"
                value={draft.currentQty}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, currentQty: Number(e.target.value) }))
                }
              />
            </label>
            <label className="field">
              <span>Birim</span>
              <select
                value={draft.unit}
                onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="field-row field-row-2">
            <label className="field">
              <span>Ne zamana alınmalı</span>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Yenileme (gün)</span>
              <input
                type="number"
                min={0}
                placeholder="Yok"
                value={draft.renewalDays ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    renewalDays: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              />
            </label>
          </div>

          <label className="field">
            <span>Not</span>
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="İsteğe bağlı"
            />
          </label>

          <div className="form-actions">
            {initial && onDelete ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onDelete()
                  onClose()
                }}
              >
                Sil
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn btn-primary">
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
