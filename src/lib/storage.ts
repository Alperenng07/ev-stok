import type { StockItem } from '../types'
import { addDays, todayISO } from './date'

const KEY = 'ev-stok-items-v1'

function uid(): string {
  return crypto.randomUUID()
}

export function sampleItems(): StockItem[] {
  const t = todayISO()
  const now = new Date().toISOString()
  return [
    {
      id: uid(),
      name: 'Süt',
      neededQty: 2,
      currentQty: 0,
      unit: 'lt',
      dueDate: t,
      renewalDays: 7,
      purchased: false,
      notes: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uid(),
      name: 'Tuvalet kağıdı',
      neededQty: 1,
      currentQty: 1,
      unit: 'paket',
      dueDate: addDays(t, 3),
      renewalDays: 21,
      purchased: false,
      notes: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uid(),
      name: 'Bulaşık deterjanı',
      neededQty: 1,
      currentQty: 1,
      unit: 'adet',
      dueDate: addDays(t, -2),
      renewalDays: 30,
      purchased: true,
      notes: 'Geçen hafta alındı',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

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

export function loadItems(): StockItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const seed = sampleItems()
      localStorage.setItem(KEY, JSON.stringify(seed))
      return seed
    }
    const parsed = JSON.parse(raw) as StockItem[]
    if (!Array.isArray(parsed)) return sampleItems()
    return renewDueItems(parsed)
  } catch {
    return sampleItems()
  }
}

export function saveItems(items: StockItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items))
}
