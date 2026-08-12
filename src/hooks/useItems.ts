import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, todayISO } from '../lib/date'
import { loadItems, saveItems } from '../lib/storage'
import type { FilterId, ItemDraft, StockItem } from '../types'

function createItem(draft: ItemDraft): StockItem {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: draft.name.trim(),
    neededQty: draft.neededQty,
    currentQty: draft.currentQty,
    unit: draft.unit.trim() || 'adet',
    dueDate: draft.dueDate,
    renewalDays: draft.renewalDays,
    purchased: false,
    notes: draft.notes.trim(),
    createdAt: now,
    updatedAt: now,
  }
}

export function useItems() {
  const [items, setItems] = useState<StockItem[]>(() => loadItems())
  const [filter, setFilter] = useState<FilterId>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    saveItems(items)
  }, [items])

  const addItem = useCallback((draft: ItemDraft) => {
    setItems((prev) => [createItem(draft), ...prev])
  }, [])

  const updateItem = useCallback((id: string, draft: ItemDraft) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name: draft.name.trim(),
              neededQty: draft.neededQty,
              currentQty: draft.currentQty,
              unit: draft.unit.trim() || 'adet',
              dueDate: draft.dueDate,
              renewalDays: draft.renewalDays,
              notes: draft.notes.trim(),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const togglePurchased = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const now = new Date().toISOString()
        if (!item.purchased) {
          const nextDue =
            item.renewalDays && item.renewalDays > 0
              ? addDays(todayISO(), item.renewalDays)
              : item.dueDate
          return {
            ...item,
            purchased: true,
            currentQty: item.currentQty + item.neededQty,
            dueDate: nextDue,
            updatedAt: now,
          }
        }
        return {
          ...item,
          purchased: false,
          updatedAt: now,
        }
      }),
    )
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return items
      .filter((item) => {
        if (q && !item.name.toLocaleLowerCase('tr').includes(q)) return false
        if (filter === 'pending') return !item.purchased
        if (filter === 'done') return item.purchased
        if (filter === 'overdue') return !item.purchased && item.dueDate < todayISO()
        return true
      })
      .sort((a, b) => {
        if (a.purchased !== b.purchased) return a.purchased ? 1 : -1
        return a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name, 'tr')
      })
  }, [items, filter, query])

  const stats = useMemo(() => {
    const pending = items.filter((i) => !i.purchased).length
    const done = items.filter((i) => i.purchased).length
    const overdue = items.filter((i) => !i.purchased && i.dueDate < todayISO()).length
    return { total: items.length, pending, done, overdue }
  }, [items])

  return {
    items,
    filtered,
    filter,
    setFilter,
    query,
    setQuery,
    stats,
    addItem,
    updateItem,
    removeItem,
    togglePurchased,
  }
}
