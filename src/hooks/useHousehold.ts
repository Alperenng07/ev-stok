import { useCallback, useEffect, useState } from 'react'
import {
  createHousehold,
  ensureAuth,
  getActiveHouseholdId,
  isCloudEnabled,
  joinHousehold,
  listMyHouseholds,
  setActiveHouseholdId,
} from '../lib/supabase'
import type { Household } from '../types'

export function useHousehold() {
  const [households, setHouseholds] = useState<Household[]>([])
  const [active, setActive] = useState<Household | null>(null)
  const [loading, setLoading] = useState(isCloudEnabled)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isCloudEnabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await ensureAuth()
      const list = await listMyHouseholds()
      setHouseholds(list)
      const saved = getActiveHouseholdId()
      const current =
        list.find((h) => h.id === saved) ?? (list.length === 1 ? list[0] : null)
      if (current) {
        setActiveHouseholdId(current.id)
        setActive(current)
      } else {
        setActive(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aile bilgisi alınamadı')
      setActive(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (name: string) => {
      setError(null)
      try {
        await ensureAuth()
        const household = await createHousehold(name)
        setActiveHouseholdId(household.id)
        setActive(household)
        setHouseholds((prev) => {
          if (prev.some((h) => h.id === household.id)) return prev
          return [...prev, household]
        })
        return household
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Aile oluşturulamadı'
        setError(message)
        throw err
      }
    },
    [],
  )

  const join = useCallback(async (code: string) => {
    setError(null)
    try {
      await ensureAuth()
      const household = await joinHousehold(code)
      setActiveHouseholdId(household.id)
      setActive(household)
      setHouseholds((prev) => {
        if (prev.some((h) => h.id === household.id)) return prev
        return [...prev, household]
      })
      return household
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Katılım başarısız'
      setError(message)
      throw err
    }
  }, [])

  const select = useCallback((household: Household) => {
    setActiveHouseholdId(household.id)
    setActive(household)
  }, [])

  const leaveActive = useCallback(() => {
    setActiveHouseholdId(null)
    setActive(null)
  }, [])

  return {
    cloudEnabled: isCloudEnabled,
    loading,
    error,
    households,
    active,
    needsHousehold: isCloudEnabled && !loading && !active,
    create,
    join,
    select,
    leaveActive,
    refresh,
  }
}
