import { purchasePlaceOptions } from '../lib/chains'
import type { PurchasePlace } from '../types'

type Props = {
  open: boolean
  itemName: string | null
  onClose: () => void
  onConfirm: (place: PurchasePlace) => void
}

export function PurchasePlaceModal({ open, itemName, onClose, onConfirm }: Props) {
  if (!open) return null

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="sheet purchase-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Nereden alındı"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>Nereden aldın?</h2>
          <button type="button" className="btn-chip" onClick={onClose}>
            Kapat
          </button>
        </div>
        {itemName ? <p className="sheet-sub">{itemName}</p> : null}
        <div className="place-grid">
          {purchasePlaceOptions().map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="place-btn"
              style={{ borderColor: opt.color }}
              onClick={() => onConfirm({ placeId: opt.id, placeLabel: opt.label })}
            >
              <span className="place-dot" style={{ background: opt.color }} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
