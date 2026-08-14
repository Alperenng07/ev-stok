import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, todayISO } from '../lib/date'
import {
  deleteItem as deleteCloudItem,
  fetchItems,
  isCloudEnabled,
  supabase,
  upsertItem,
} from '../lib/supabase'
import type { FilterId, ItemDraft, PurchasePlace, StockItem } from '../types'

function createItem(draft: ItemDraft, householdId: string): StockItem {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    householdId,
    name: draft.name.trim(),
    neededQty: draft.neededQty,
    currentQty: draft.currentQty,
    unit: draft.unit.trim() || 'adet',
    dueDate: draft.dueDate,
    renewalDays: draft.renewalDays,
    purchased: false,
    purchasedPlaceId: null,
    purchasedPlaceLabel: null,
    notes: draft.notes.trim(),
    createdAt: now,
    updatedAt: now,
  }
}

function withPurchasedToggle(item: StockItem, place?: PurchasePlace): StockItem {
  const now = new Date().toISOString()
  if (!item.purchased) {
    const renewal = item.renewalDays && item.renewalDays > 0 ? item.renewalDays : null
    return {
      ...item,
      purchased: true,
      purchasedPlaceId: place?.placeId ?? null,
      purchasedPlaceLabel: place?.placeLabel ?? null,
      currentQty: item.currentQty + item.neededQty,
      dueDate: renewal ? addDays(todayISO(), renewal) : item.dueDate,
      updatedAt: now,
    }
  }
  return {
    ...item,
    purchased: false,
    purchasedPlaceId: null,
    purchasedPlaceLabel: null,
    updatedAt: now,
  }
}

export function useItems(householdId: string | null) {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(Boolean(householdId))
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
    if (!householdId || !isCloudEnabled || !supabase) {
      setItems([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function boot() {
      try {
        const remote = await fetchItems(householdId!)
        if (!cancelled) {
          setItems(remote)
          setSyncError(null)
        }
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
      .channel(`items-live-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void fetchItems(householdId!)
            .then((remote) => {
              if (cancelled) return
              setItems((local) => {
                const map = new Map(remote.map((item) => [item.id, item]))
                for (const item of local) {
                  if (item.householdId !== householdId) continue
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
  }, [householdId])

  const addItem = useCallback(
    (draft: ItemDraft) => {
      if (!householdId) return
      const item = createItem(draft, householdId)
      setItems((prev) => [item, ...prev])
      void persist(item)
    },
    [householdId, persist],
  )

  const updateItem = useCallback(
    (id: string, draft: ItemDraft) => {
      setItems((prev) => {
        const current = prev.find((item) => item.id === id)
        if (!current) return prev
        const next: StockItem = {
          ...current,
          name: draft.name.trim(),
          neededQty: draft.neededQty,
          currentQty: draft.currentQty,
          unit: draft.unit.trim() || 'adet',
          dueDate: draft.dueDate,
          renewalDays: draft.renewalDays,
          notes: draft.notes.trim(),
          updatedAt: new Date().toISOString(),
        }
        void persist(next)
        return prev.map((item) => (item.id === id ? next : item))
      })
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
    async (id: string, place?: PurchasePlace) => {
      const current = items.find((item) => item.id === id)
      if (!current) return
      const next = withPurchasedToggle(current, place)
      setItems((prev) => prev.map((item) => (item.id === id ? next : item)))
      await persist(next)
    },
    [items, persist],
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
