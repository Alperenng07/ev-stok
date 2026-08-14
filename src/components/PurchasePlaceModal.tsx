import { purchasePlaceOptionsFromOffers, type PurchasePlaceOption } from '../lib/chains'
import { formatTry } from '../lib/budgetPlanner'
import type { PurchasePlace } from '../types'

type Props = {
  open: boolean
  itemName: string | null
  /** Bu ürün için son bütçe hesabındaki teklifler; yoksa yalnızca Diğer */
  offers?: { chainId: string; unitPrice: number }[] | null
  onClose: () => void
  onConfirm: (place: PurchasePlace) => void
}

export function PurchasePlaceModal({ open, itemName, offers, onClose, onConfirm }: Props) {
  if (!open) return null

  const options: PurchasePlaceOption[] = purchasePlaceOptionsFromOffers(offers)
  const pricedCount = options.filter((o) => o.id !== 'other').length

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
        <p className="sheet-sub">
          {pricedCount > 0
            ? 'Yalnızca bu ürün için fiyatı bulunan marketler listeleniyor.'
            : 'Bu ürün için hesaplanmış market fiyatı yok. Diğer’i seçebilir veya önce Hesapla.'}
        </p>
        <div className="place-grid">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="place-btn"
              style={{ borderColor: opt.color }}
              onClick={() => onConfirm({ placeId: opt.id, placeLabel: opt.label })}
            >
              <span className="place-dot" style={{ background: opt.color }} />
              <span className="place-label">
                {opt.label}
                {opt.unitPrice != null ? (
                  <small className="place-price">{formatTry(opt.unitPrice)}</small>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
