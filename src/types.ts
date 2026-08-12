export type StockItem = {
  id: string
  name: string
  neededQty: number
  currentQty: number
  unit: string
  dueDate: string
  renewalDays: number | null
  purchased: boolean
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
