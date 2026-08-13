import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, todayISO } from '../lib/date'
import { renewDueItems } from '../lib/storage'
import {
  deleteItem as deleteCloudItem,
  fetchItems,
  isCloudEnabled,
  supabase,
  upsertItem,
} from '../lib/supabase'
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
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(isCloudEnabled)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')
  const [query, setQuery] = useState('')

  const persist = useCallback(async (item: StockItem) => {
    if (!isCloudEnabled) return
    try {
      await upsertItem(item)
      setSyncError(null)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Kayıt hatası')
    }
  }, [])

  useEffect(() => {
    if (!isCloudEnabled || !supabase) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function boot() {
      try {
        const remote = await fetchItems()
        if (cancelled) return
        const renewed = renewDueItems(remote)
        setItems(renewed)
        // Yenilenenleri sırayla yaz; kullanıcı tıklamasıyla yarışmasın diye await
        for (const item of renewed) {
          const before = remote.find((r) => r.id === item.id)
          if (before && before.purchased !== item.purchased) {
            await upsertItem(item)
          }
        }
        setSyncError(null)
      } catch (err) {
        if (!cancelled) {
          setSyncError(err instanceof Error ? err.message : 'Bağlantı hatası')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void boot()

    const channel = supabase
      .channel('items-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        () => {
          // Canlı yenilemede sunucu halini al; daha yeni yerel değişiklikleri ezme
          void fetchItems()
            .then((remote) => {
              if (cancelled) return
              setItems((local) => {
                const map = new Map(remote.map((item) => [item.id, item]))
                for (const item of local) {
                  const remoteItem = map.get(item.id)
                  if (!remoteItem || item.updatedAt > remoteItem.updatedAt) {
                    map.set(item.id, item)
                  }
                }
                return Array.from(map.values())
              })
            })
            .catch(() => undefined)
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void channel.unsubscribe()
    }
  }, [])

  const addItem = useCallback(
    (draft: ItemDraft) => {
      const item = createItem(draft)
      setItems((prev) => [item, ...prev])
      void persist(item)
    },
    [persist],
  )

  const updateItem = useCallback(
    (id: string, draft: ItemDraft) => {
      let next: StockItem | null = null
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item
          next = {
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
          return next
        }),
      )
      if (next) void persist(next)
    },
    [persist],
  )

  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    if (!isCloudEnabled) return
    try {
      await deleteCloudItem(id)
      setSyncError(null)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Silme hatası')
    }
  }, [])

  const togglePurchased = useCallback(
    (id: string) => {
      let next: StockItem | null = null
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item
          const now = new Date().toISOString()
          if (!item.purchased) {
            const renewal =
              item.renewalDays && item.renewalDays > 0 ? item.renewalDays : null
            // Alındı olunca sonraki vade ileri alınır; bugün tekrar kırmızıya düşmez
            const nextDue = renewal ? addDays(todayISO(), renewal) : item.dueDate
            next = {
              ...item,
              purchased: true,
              currentQty: item.currentQty + item.neededQty,
              dueDate: nextDue,
              updatedAt: now,
            }
            return next
          }
          next = {
            ...item,
            purchased: false,
            updatedAt: now,
          }
          return next
        }),
      )
      if (next) void persist(next)
    },
    [persist],
  )

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
    loading,
    syncError,
    cloudEnabled: isCloudEnabled,
    addItem,
    updateItem,
    removeItem,
    togglePurchased,
  }
}
