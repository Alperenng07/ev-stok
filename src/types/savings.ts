export type SavingsPeriod = 'day' | 'week' | 'month' | 'year' | 'all'

/** Tek ürün alındığında otomatik oluşan bilanço kaydı */
export type SavingsEntry = {
  id: string
  createdAt: string
  familyId: string
  userId: string
  itemId: string
  itemName: string
  placeId: string
  placeLabel: string
  paidUnitPrice: number
  qty: number
  savedAmount: number
  missedAmount: number
  minUnitPrice: number
  maxUnitPrice: number
  catalogName: string | null
  locationLabel: string
  planTitle?: string
  comparedAgainst?: string
  note?: string
  itemCount?: number
  amount?: number
}
