import { createContext, useContext, type ReactNode } from 'react'
import { useHousehold } from '../hooks/useHousehold'

type HouseholdApi = ReturnType<typeof useHousehold>

const HouseholdContext = createContext<HouseholdApi | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const value = useHousehold()
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHouseholdContext() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHouseholdContext HouseholdProvider içinde kullanılmalı')
  return ctx
}
