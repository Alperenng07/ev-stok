import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { StockItem } from '../types'

export type DbItem = {
  id: string
  name: string
  needed_qty: number
  current_qty: number
  unit: string
  due_date: string
  renewal_days: number | null
  purchased: boolean
  notes: string
  created_at: string
  updated_at: string
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isCloudEnabled = Boolean(url && key)

export const supabase: SupabaseClient | null = isCloudEnabled
  ? createClient(url!, key!)
  : null

function asDateOnly(value: string): string {
  return value.slice(0, 10)
}

export function toStockItem(row: DbItem): StockItem {
  return {
    id: row.id,
    name: row.name,
    neededQty: Number(row.needed_qty),
    currentQty: Number(row.current_qty),
    unit: row.unit,
    dueDate: asDateOnly(row.due_date),
    renewalDays:
      row.renewal_days === null || row.renewal_days === undefined
        ? null
        : Number(row.renewal_days),
    purchased: Boolean(row.purchased),
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toDbItem(item: StockItem): DbItem {
  return {
    id: item.id,
    name: item.name,
    needed_qty: item.neededQty,
    current_qty: item.currentQty,
    unit: item.unit,
    due_date: item.dueDate,
    renewal_days: item.renewalDays,
    purchased: item.purchased,
    notes: item.notes,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }
}

export async function fetchItems(): Promise<StockItem[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('due_date', { ascending: true })
  if (error) throw error
  return (data as DbItem[]).map(toStockItem)
}

export async function upsertItem(item: StockItem): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('items').upsert(toDbItem(item))
  if (error) throw error
}

export async function deleteItem(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}
