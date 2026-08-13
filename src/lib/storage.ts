import type { StockItem } from '../types'

/** Eski otomatik geri alma kaldırıldı — durum sadece kullanıcı değişince güncellenir. */
export function renewDueItems(items: StockItem[]): StockItem[] {
  return items
}
