import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createHousehold,
  ensureAuth,
  getActiveHouseholdId,
  getCurrentUserId,
  getLocalProfile,
  isCloudEnabled,
  joinHousehold,
  leaveHousehold,
  listHouseholdMembers,
  listMyHouseholds,
  removeHouseholdMember,
  setActiveHouseholdId,
  setLocalProfile,
  updateMyMemberProfile,
  type LocalProfile,
} from '../lib/supabase'
import type { Household, HouseholdMember } from '../types'

export function useHousehold() {
  const [households, setHouseholds] = useState<Household[]>([])
  const [active, setActive] = useState<Household | null>(null)
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<LocalProfile>(() => getLocalProfile())
  const [loading, setLoading] = useState(isCloudEnabled)
  const [error, setError] = useState<string | null>(null)

  const refreshMembers = useCallback(async (householdId: string) => {
    try {
      const list = await listHouseholdMembers(householdId)
      setMembers(list)
    } catch {
      setMembers([])
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!isCloudEnabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await ensureAuth()
      const uid = await getCurrentUserId()
      setUserId(uid)
      const list = await listMyHouseholds()
      setHouseholds(list)
      const saved = getActiveHouseholdId()
      const current =
        list.find((h) => h.id === saved) ?? (list.length === 1 ? list[0] : null)
      if (current) {
        setActiveHouseholdId(current.id)
        setActive(current)
        await refreshMembers(current.id)
      } else {
        setActive(null)
        setMembers([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aile bilgisi alınamadı')
      setActive(null)
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [refreshMembers])

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
        await refreshMembers(household.id)
        return household
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Aile oluşturulamadı'
        setError(message)
        throw err
      }
    },
    [refreshMembers],
  )

  const join = useCallback(
    async (code: string) => {
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
        await refreshMembers(household.id)
        return household
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Katılım başarısız'
        setError(message)
        throw err
      }
    },
    [refreshMembers],
  )

  const select = useCallback(
    async (household: Household) => {
      setActiveHouseholdId(household.id)
      setActive(household)
      await refreshMembers(household.id)
    },
    [refreshMembers],
  )

  const leaveActiveDevice = useCallback(() => {
    setActiveHouseholdId(null)
    setActive(null)
    setMembers([])
  }, [])

  const leaveFamily = useCallback(async () => {
    if (!active) throw new Error('Aktif aile yok')
    await leaveHousehold(active.id)
    setHouseholds((prev) => prev.filter((h) => h.id !== active.id))
    setActiveHouseholdId(null)
    setActive(null)
    setMembers([])
  }, [active])

  const removeMember = useCallback(
    async (targetUserId: string) => {
      if (!active) throw new Error('Aktif aile yok')
      await removeHouseholdMember(active.id, targetUserId)
      await refreshMembers(active.id)
    },
    [active, refreshMembers],
  )

  const saveProfile = useCallback(
    async (next: LocalProfile) => {
      setLocalProfile(next)
      setProfile(next)
      if (active) {
        await updateMyMemberProfile(active.id, next)
        await refreshMembers(active.id)
      }
    },
    [active, refreshMembers],
  )

  const myRole = useMemo(() => {
    if (!userId) return null
    return members.find((m) => m.userId === userId)?.role ?? null
  }, [members, userId])

  return {
    cloudEnabled: isCloudEnabled,
    loading,
    error,
    households,
    active,
    members,
    userId,
    myRole,
    profile,
    needsHousehold: isCloudEnabled && !loading && !active,
    create,
    join,
    select,
    leaveActiveDevice,
    leaveFamily,
    removeMember,
    saveProfile,
    refresh,
  }
}
