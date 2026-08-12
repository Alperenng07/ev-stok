import { daysUntil, formatShortTR, isOverdue } from '../lib/date'
import type { StockItem } from '../types'

type Props = {
  item: StockItem
  onToggle: () => void
  onEdit: () => void
}

export function ItemRow({ item, onToggle, onEdit }: Props) {
  const overdue = isOverdue(item.dueDate, item.purchased)
  const until = daysUntil(item.dueDate)
  let dueLabel = formatShortTR(item.dueDate)
  if (!item.purchased) {
    if (until === 0) dueLabel = 'Bugün'
    else if (until === 1) dueLabel = 'Yarın'
    else if (until < 0) dueLabel = `${Math.abs(until)} gün gecikti`
  }

  return (
    <article
      className={`item ${item.purchased ? 'item-done' : 'item-pending'}${overdue ? ' item-overdue' : ''}`}
    >
      <button
        type="button"
        className="status-btn"
        onClick={onToggle}
        aria-label={item.purchased ? 'Alınmadı olarak işaretle' : 'Alındı olarak işaretle'}
        title={item.purchased ? 'Alındı' : 'Alınacak'}
      >
        <span className="status-dot" />
      </button>

      <button type="button" className="item-body" onClick={onEdit}>
        <div className="item-top">
          <h3>{item.name}</h3>
          <span className="due-chip">{dueLabel}</span>
        </div>
        <div className="item-meta">
          <span>
            Alınacak <strong>{item.neededQty}</strong> {item.unit}
          </span>
          <span className="dot-sep" aria-hidden />
          <span>
            Mevcut <strong>{item.currentQty}</strong> {item.unit}
          </span>
          {item.renewalDays ? (
            <>
              <span className="dot-sep" aria-hidden />
              <span>Her {item.renewalDays} gün</span>
            </>
          ) : null}
        </div>
        {item.notes ? <p className="item-notes">{item.notes}</p> : null}
      </button>
    </article>
  )
}
