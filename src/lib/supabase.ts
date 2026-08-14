import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Household, HouseholdMember, StockItem } from '../types'

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
  purchased_place_id?: string | null
  purchased_place_label?: string | null
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

type DbMember = {
  household_id: string
  user_id: string
  role: string | null
  display_name: string | null
  email: string | null
  joined_at: string
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
const PROFILE_KEY = 'ev-stok-profile'

export type LocalProfile = {
  displayName: string
  email: string
}

export function getLocalProfile(): LocalProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return { displayName: '', email: '' }
    const parsed = JSON.parse(raw) as Partial<LocalProfile>
    return {
      displayName: parsed.displayName ?? '',
      email: parsed.email ?? '',
    }
  } catch {
    return { displayName: '', email: '' }
  }
}

export function setLocalProfile(profile: LocalProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

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

function toMember(row: DbMember): HouseholdMember {
  return {
    householdId: row.household_id,
    userId: row.user_id,
    role: row.role === 'owner' ? 'owner' : 'member',
    displayName: row.display_name?.trim() || 'Üye',
    email: row.email ?? '',
    joinedAt: row.joined_at,
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
    purchasedPlaceId: row.purchased_place_id ?? null,
    purchasedPlaceLabel: row.purchased_place_label ?? null,
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
    purchased_place_id: item.purchasedPlaceId,
    purchased_place_label: item.purchasedPlaceLabel,
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

export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
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
  const household = toHousehold(data as DbHousehold)
  const profile = getLocalProfile()
  if (profile.displayName || profile.email) {
    try {
      await updateMyMemberProfile(household.id, profile)
    } catch {
      /* migration henüz uygulanmamış olabilir */
    }
  }
  return household
}

export async function joinHousehold(code: string): Promise<Household> {
  if (!supabase) throw new Error('Bulut bağlı değil')
  const { data, error } = await supabase.rpc('join_household', {
    p_code: code.trim().toUpperCase(),
  })
  if (error) throw error
  const household = toHousehold(data as DbHousehold)
  const profile = getLocalProfile()
  if (profile.displayName || profile.email) {
    try {
      await updateMyMemberProfile(household.id, profile)
    } catch {
      /* ignore */
    }
  }
  return household
}

export async function listHouseholdMembers(
  householdId: string,
): Promise<HouseholdMember[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id,user_id,role,display_name,email,joined_at')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as DbMember[]).map(toMember)
}

export async function removeHouseholdMember(
  householdId: string,
  userId: string,
): Promise<void> {
  if (!supabase) throw new Error('Bulut bağlı değil')
  const { error } = await supabase.rpc('remove_household_member', {
    p_household_id: householdId,
    p_user_id: userId,
  })
  if (error) throw error
}

export async function leaveHousehold(householdId: string): Promise<void> {
  if (!supabase) throw new Error('Bulut bağlı değil')
  const { error } = await supabase.rpc('leave_household', {
    p_household_id: householdId,
  })
  if (error) throw error
}

export async function updateMyMemberProfile(
  householdId: string,
  profile: LocalProfile,
): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('update_my_member_profile', {
    p_household_id: householdId,
    p_display_name: profile.displayName.trim() || 'Üye',
    p_email: profile.email.trim(),
  })
  if (error) throw error
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

export type ReminderEmail = {
  id: string
  householdId: string
  email: string
}

export async function listReminderEmails(
  householdId: string,
): Promise<ReminderEmail[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('reminder_emails')
    .select('id,household_id,email')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as { id: string; household_id: string; email: string }[]).map(
    (row) => ({
      id: row.id,
      householdId: row.household_id,
      email: row.email,
    }),
  )
}

export async function addReminderEmail(
  householdId: string,
  email: string,
): Promise<void> {
  if (!supabase) throw new Error('Bulut bağlı değil')
  const clean = email.trim().toLowerCase()
  if (!clean.includes('@')) throw new Error('Geçerli bir e-posta girin')
  const { error } = await supabase.from('reminder_emails').insert({
    household_id: householdId,
    email: clean,
  })
  if (error) throw error
}

export async function removeReminderEmail(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('reminder_emails').delete().eq('id', id)
  if (error) throw error
}
