import type { StockItem } from '../types'
import { todayISO } from './date'

/**
 * Yenileme tarihi gelen alınanları tekrar alınacağa çeker.
 * Bugün alınan ürünler aynı gün geri alınmaz (updatedAt koruması).
 */
export function renewDueItems(items: StockItem[]): StockItem[] {
  const today = todayISO()
  let changed = false
  const next = items.map((item) => {
    if (
      !item.purchased ||
      !item.renewalDays ||
      item.renewalDays <= 0 ||
      item.dueDate > today
    ) {
      return item
    }

    // Bugün işaretlenen "alındı" hemen kırmızıya düşmesin
    const updatedDay = item.updatedAt.slice(0, 10)
    if (updatedDay >= today) return item

    changed = true
    return {
      ...item,
      purchased: false,
      updatedAt: new Date().toISOString(),
    }
  })
  return changed ? next : items
}
