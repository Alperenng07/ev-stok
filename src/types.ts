export type Household = {
  id: string
  name: string
  inviteCode: string
  createdAt: string
}

export type HouseholdMember = {
  householdId: string
  userId: string
  role: 'owner' | 'member'
  displayName: string
  email: string
  joinedAt: string
}

export type StockItem = {
  id: string
  householdId: string
  name: string
  neededQty: number
  currentQty: number
  unit: string
  dueDate: string
  renewalDays: number | null
  purchased: boolean
  purchasedPlaceId: string | null
  purchasedPlaceLabel: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export type ItemDraft = {
  name: string
  neededQty: number
  currentQty: number
  unit: string
  dueDate: string
  renewalDays: number | null
  notes: string
}

export type FilterId = 'all' | 'pending' | 'done' | 'overdue'

export type PurchasePlace = {
  placeId: string
  placeLabel: string
}

export type AppTab = 'list' | 'budget' | 'reports' | 'family' | 'profile'
