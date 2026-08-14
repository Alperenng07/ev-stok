import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { savingsStore } from '../lib/savingsStore'
import {
  buildTrend,
  filterByPeriod,
  periodLabel,
  sumMissed,
  sumSaved,
} from '../lib/savingsStats'
import type { SavingsEntry, SavingsPeriod } from '../types/savings'

type AddPurchaseSavingsInput = {
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
}

type SavingsContextValue = {
  entries: SavingsEntry[]
  loading: boolean
  period: SavingsPeriod
  setPeriod: (p: SavingsPeriod) => void
  periodEntries: SavingsEntry[]
  periodSavedTotal: number
  periodMissedTotal: number
  periodTitle: string
  trend: { label: string; amount: number }[]
  refresh: () => Promise<void>
  addPurchaseSavings: (input: AddPurchaseSavingsInput) => Promise<SavingsEntry | null>
  removeSavings: (id: string) => Promise<void>
}

const SavingsContext = createContext<SavingsContextValue | null>(null)

export function SavingsProvider({
  children,
  householdId,
  userId,
}: {
  children: ReactNode
  householdId: string | null
  userId: string | null
}) {
  const [entries, setEntries] = useState<SavingsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<SavingsPeriod>('month')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const all = await savingsStore.list()
      const scoped = householdId ? all.filter((e) => e.familyId === householdId) : []
      setEntries(scoped)
    } finally {
      setLoading(false)
    }
  }, [householdId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const periodEntries = useMemo(() => filterByPeriod(entries, period), [entries, period])
  const periodSavedTotal = useMemo(() => sumSaved(periodEntries), [periodEntries])
  const periodMissedTotal = useMemo(() => sumMissed(periodEntries), [periodEntries])
  const periodTitle = periodLabel(period)
  const trend = useMemo(() => {
    if (period === 'day' || period === 'week') return buildTrend(entries, 'week')
    if (period === 'year' || period === 'all') return buildTrend(entries, 'year')
    return buildTrend(entries, 'month')
  }, [entries, period])

  const addPurchaseSavings = useCallback(
    async (input: AddPurchaseSavingsInput) => {
      if (!userId || !householdId) throw new Error('Oturum / aile gerekli')
      if (input.savedAmount <= 0 && input.missedAmount <= 0) return null

      const entry: SavingsEntry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        familyId: householdId,
        userId,
        itemId: input.itemId,
        itemName: input.itemName,
        placeId: input.placeId,
        placeLabel: input.placeLabel,
        paidUnitPrice: input.paidUnitPrice,
        qty: input.qty,
        savedAmount: input.savedAmount,
        missedAmount: input.missedAmount,
        minUnitPrice: input.minUnitPrice,
        maxUnitPrice: input.maxUnitPrice,
        catalogName: input.catalogName,
        locationLabel: input.locationLabel,
      }
      await savingsStore.add(entry)
      await refresh()
      return entry
    },
    [userId, householdId, refresh],
  )

  const removeSavings = useCallback(
    async (id: string) => {
      await savingsStore.remove(id)
      await refresh()
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      entries,
      loading,
      period,
      setPeriod,
      periodEntries,
      periodSavedTotal,
      periodMissedTotal,
      periodTitle,
      trend,
      refresh,
      addPurchaseSavings,
      removeSavings,
    }),
    [
      entries,
      loading,
      period,
      periodEntries,
      periodSavedTotal,
      periodMissedTotal,
      periodTitle,
      trend,
      refresh,
      addPurchaseSavings,
      removeSavings,
    ],
  )

  return <SavingsContext.Provider value={value}>{children}</SavingsContext.Provider>
}

export function useSavings() {
  const ctx = useContext(SavingsContext)
  if (!ctx) throw new Error('useSavings SavingsProvider içinde kullanılmalı')
  return ctx
}
