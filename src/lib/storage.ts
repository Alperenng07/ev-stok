import type { StockItem } from '../types'
import { todayISO } from './date'

/** Takvime göre: yenileme süresi olan ve vadesi gelen alınanlar yeniden kırmızıya düşer. */
export function renewDueItems(items: StockItem[]): StockItem[] {
  const today = todayISO()
  let changed = false
  const next = items.map((item) => {
    if (
      item.purchased &&
      item.renewalDays &&
      item.renewalDays > 0 &&
      item.dueDate <= today
    ) {
      changed = true
      return {
        ...item,
        purchased: false,
        updatedAt: new Date().toISOString(),
      }
    }
    return item
  })
  return changed ? next : items
}
