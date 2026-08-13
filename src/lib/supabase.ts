import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Household, StockItem } from '../types'

export type DbItem = {
  id: string
  household_id: string
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

type DbHousehold = {
  id: string
  name: string
  invite_code: string
  created_at: string
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isCloudEnabled = Boolean(url && key)

export const supabase: SupabaseClient | null = isCloudEnabled
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

const ACTIVE_HOUSEHOLD_KEY = 'ev-stok-active-household'

export function getActiveHouseholdId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_HOUSEHOLD_KEY)
  } catch {
    return null
  }
}

export function setActiveHouseholdId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_HOUSEHOLD_KEY, id)
    else localStorage.removeItem(ACTIVE_HOUSEHOLD_KEY)
  } catch {
    /* ignore */
  }
}

function asDateOnly(value: string): string {
  return value.slice(0, 10)
}

function toHousehold(row: DbHousehold): Household {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
  }
}

export function toStockItem(row: DbItem): StockItem {
  return {
    id: row.id,
    householdId: row.household_id,
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
    household_id: item.householdId,
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

export async function ensureAuth(): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  if (data.session) return
  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
}

export async function listMyHouseholds(): Promise<Household[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('households')
    .select('id,name,invite_code,created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as DbHousehold[]).map(toHousehold)
}

export async function createHousehold(name: string): Promise<Household> {
  if (!supabase) throw new Error('Bulut bağlı değil')
  const { data, error } = await supabase.rpc('create_household', {
    p_name: name.trim(),
  })
  if (error) throw error
  return toHousehold(data as DbHousehold)
}

export async function joinHousehold(code: string): Promise<Household> {
  if (!supabase) throw new Error('Bulut bağlı değil')
  const { data, error } = await supabase.rpc('join_household', {
    p_code: code.trim().toUpperCase(),
  })
  if (error) throw error
  return toHousehold(data as DbHousehold)
}

export async function fetchItems(householdId: string): Promise<StockItem[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('household_id', householdId)
    .order('due_date', { ascending: true })
  if (error) throw error
  return (data as DbItem[]).map(toStockItem)
}

export async function upsertItem(item: StockItem): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('items').upsert(toDbItem(item), {
    onConflict: 'id',
  })
  if (error) throw error
}

export async function deleteItem(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}
