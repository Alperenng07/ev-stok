import { useEffect, useState } from 'react'
import { BudgetPanel } from './components/BudgetPanel'
import { FamilyBar } from './components/FamilyBar'
import { FamilyPanel } from './components/FamilyPanel'
import { HouseholdGate } from './components/HouseholdGate'
import { ItemForm } from './components/ItemForm'
import { ItemRow } from './components/ItemRow'
import { ProfilePanel } from './components/ProfilePanel'
import { PurchasePlaceModal } from './components/PurchasePlaceModal'
import { ReminderMailsSheet } from './components/ReminderMailsSheet'
import { ReportsPanel } from './components/ReportsPanel'
import { TabBar } from './components/TabBar'
import { BudgetCacheProvider, useBudgetCache } from './context/BudgetCacheContext'
import { HouseholdProvider, useHouseholdContext } from './context/HouseholdContext'
import { SavingsProvider, useSavings } from './context/SavingsContext'
import { useItems } from './hooks/useItems'
import { formatTry } from './lib/budgetPlanner'
import { budgetLocationKey } from './lib/location'
import { locationPrefsStore } from './lib/locationPrefsStore'
import { computePurchaseSavings } from './lib/purchaseSavings'
import type { AppTab, FilterId, PurchasePlace, StockItem } from './types'
import './App.css'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'pending', label: 'Alınacak' },
  { id: 'done', label: 'Alındı' },
  { id: 'overdue', label: 'Geciken' },
]

function AppShell() {
  const household = useHouseholdContext()
  const {
    items,
    filtered,
    filter,
    setFilter,
    query,
    setQuery,
    stats,
    loading,
    syncError,
    cloudEnabled,
    addItem,
    updateItem,
    removeItem,
    togglePurchased,
  } = useItems(household.active?.id ?? null)

  const { hasCacheFor, getLineForItemAt, result: budgetResult } = useBudgetCache()
  const { addPurchaseSavings } = useSavings()

  const [tab, setTab] = useState<AppTab>('list')
  const [budgetAutostart, setBudgetAutostart] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StockItem | null>(null)
  const [extraGate, setExtraGate] = useState<'create' | 'join' | null>(null)
  const [mailsOpen, setMailsOpen] = useState(false)
  const [placeItem, setPlaceItem] = useState<StockItem | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [locationKey, setLocationKey] = useState(() =>
    budgetLocationKey(locationPrefsStore.load()),
  )
  const hasCache = hasCacheFor(locationKey)
  const getLineForItem = (itemId: string) => getLineForItemAt(itemId, locationKey)

  useEffect(() => {
    if (tab === 'list' || tab === 'budget') {
      setLocationKey(budgetLocationKey(locationPrefsStore.load()))
    }
  }, [tab, budgetResult])

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(item: StockItem) {
    setEditing(item)
    setFormOpen(true)
  }

  function goCalculate() {
    setBudgetAutostart(true)
    setTab('budget')
  }

  function onToggle(item: StockItem) {
    if (item.purchased) {
      void togglePurchased(item.id)
      return
    }
    setPlaceItem(item)
  }

  async function onPlaceConfirm(place: PurchasePlace) {
    if (!placeItem) return
    const item = placeItem
    setPlaceItem(null)

    await togglePurchased(item.id, place)

    if (place.placeId === 'other') {
      setFlash('Alındı · Diğer (bilanço için fiyat yok)')
      return
    }

    if (!hasCache) {
      setFlash('Alındı kaydedildi. Bilanço için önce Bütçe’de Hesapla.')
      return
    }

    const line = getLineForItem(item.id)
    if (!line) {
      setFlash('Alındı kaydedildi. Bu ürün son hesapta yoktu; tekrar Hesapla.')
      return
    }

    const calc = computePurchaseSavings(line, place.placeId)
    if (!calc) {
      setFlash(`Alındı · ${place.placeLabel} (bu markette fiyat yoktu)`)
      return
    }

    await addPurchaseSavings({
      itemId: item.id,
      itemName: item.name,
      placeId: place.placeId,
      placeLabel: place.placeLabel,
      paidUnitPrice: calc.paidUnitPrice,
      qty: calc.qty,
      savedAmount: calc.savedAmount,
      missedAmount: calc.missedAmount,
      minUnitPrice: calc.minUnitPrice,
      maxUnitPrice: calc.maxUnitPrice,
      catalogName: calc.catalogName,
      locationLabel: budgetResult?.locationLabel ?? '',
    })

    const parts: string[] = [`Alındı · ${place.placeLabel}`]
    if (calc.savedAmount > 0) parts.push(`+${formatTry(calc.savedAmount)} tasarruf`)
    if (calc.missedAmount > 0) parts.push(`${formatTry(calc.missedAmount)} kaçırılan`)
    setFlash(parts.join(' · '))
  }

  if (!cloudEnabled) {
    return (
      <div className="app">
        <div className="banner warn">Bulut ayarları eksik. Yöneticiye bildirin.</div>
      </div>
    )
  }

  if (household.loading) {
    return (
      <div className="app">
        <div className="empty">
          <p>Aile yükleniyor…</p>
        </div>
      </div>
    )
  }

  if (household.needsHousehold || extraGate) {
    return (
      <HouseholdGate
        error={household.error}
        initialMode={extraGate ?? 'choose'}
        allowCancel={Boolean(extraGate && household.active)}
        onCancel={() => setExtraGate(null)}
        onCreate={async (name) => {
          await household.create(name)
          setExtraGate(null)
        }}
        onJoin={async (code) => {
          await household.join(code)
          setExtraGate(null)
        }}
      />
    )
  }

  if (!household.active) return null

  return (
    <div className="app app-tabs">
      <div className="bg-glow" aria-hidden />

      <header className="top">
        <div className="brand-block">
          <p className="brand">Ev Stok</p>
          <p className="tagline">{household.active.name}</p>
        </div>
        {tab === 'list' ? (
          <button
            type="button"
            className={`btn ${hasCache ? 'btn-secondary' : 'btn-primary'} calc-btn`}
            onClick={goCalculate}
          >
            {hasCache ? 'Tekrar hesapla' : 'Hesapla'}
          </button>
        ) : (
          <span className={`sync-pill${syncError ? ' err' : ''}`}>
            {syncError ? 'Senkron hata' : 'Bulut açık'}
          </span>
        )}
      </header>

      {tab === 'list' ? (
        <FamilyBar
          active={household.active}
          households={household.households}
          onSelect={(h) => void household.select(h)}
          onLeave={household.leaveActiveDevice}
          onCreateRequest={() => setExtraGate('create')}
          onJoinRequest={() => setExtraGate('join')}
          onMailsRequest={() => setMailsOpen(true)}
        />
      ) : null}

      {hasCache && tab === 'list' ? (
        <div className="banner ok">Bütçe hazır. Alındı + market seçince tasarruf bilançoya düşer.</div>
      ) : null}
      {!hasCache && tab === 'list' ? (
        <div className="banner warn">Önce Hesapla’ya bas. Sonra alındı marketi seçince bilanço dolar.</div>
      ) : null}
      {flash && tab === 'list' ? <div className="banner ok">{flash}</div> : null}
      {syncError ? <div className="banner err">{syncError}</div> : null}

      {tab === 'list' ? (
        <>
          <section className="stats" aria-label="Özet">
            <div className="stat">
              <span className="stat-n">{stats.pending}</span>
              <span className="stat-l">alınacak</span>
            </div>
            <div className="stat">
              <span className="stat-n ok">{stats.done}</span>
              <span className="stat-l">alındı</span>
            </div>
            <div className="stat">
              <span className="stat-n warn">{stats.overdue}</span>
              <span className="stat-l">geciken</span>
            </div>
          </section>

          <div className="toolbar">
            <label className="search">
              <span className="sr-only">Ara</span>
              <input
                type="search"
                placeholder="Ürün ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="filters" role="tablist" aria-label="Filtre">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  className={filter === f.id ? 'active' : ''}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <main className="list">
            {loading ? (
              <div className="empty">
                <p>Liste yükleniyor…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <p>Burada henüz ürün yok.</p>
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  İlk ürünü ekle
                </button>
              </div>
            ) : (
              filtered.map((item, i) => (
                <div
                  key={item.id}
                  className="list-anim"
                  style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                >
                  <ItemRow
                    item={item}
                    onToggle={() => onToggle(item)}
                    onEdit={() => openEdit(item)}
                  />
                </div>
              ))
            )}
          </main>

          <button type="button" className="fab" onClick={openCreate} aria-label="Ürün ekle">
            <span aria-hidden>+</span>
            <span className="fab-label">Ekle</span>
          </button>
        </>
      ) : null}

      {tab === 'budget' ? (
        <BudgetPanel
          items={items}
          autostart={budgetAutostart}
          onAutostartConsumed={() => setBudgetAutostart(false)}
        />
      ) : null}

      {tab === 'reports' ? <ReportsPanel /> : null}

      {tab === 'family' ? (
        <FamilyPanel
          active={household.active}
          members={household.members}
          userId={household.userId}
          myRole={household.myRole}
          onRemoveMember={household.removeMember}
          onLeaveFamily={household.leaveFamily}
          onCreateRequest={() => setExtraGate('create')}
          onJoinRequest={() => setExtraGate('join')}
          onMailsRequest={() => setMailsOpen(true)}
          onLeaveDevice={household.leaveActiveDevice}
        />
      ) : null}

      {tab === 'profile' ? (
        <ProfilePanel
          profile={household.profile}
          household={household.active}
          onSave={household.saveProfile}
        />
      ) : null}

      <TabBar active={tab} onChange={setTab} />

      <ItemForm
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={(draft) => {
          if (editing) updateItem(editing.id, draft)
          else addItem(draft)
        }}
        onDelete={editing ? () => void removeItem(editing.id) : undefined}
      />

      <PurchasePlaceModal
        open={Boolean(placeItem)}
        itemName={placeItem?.name ?? null}
        offers={placeItem ? getLineForItem(placeItem.id)?.offers ?? [] : null}
        onClose={() => setPlaceItem(null)}
        onConfirm={(place) => void onPlaceConfirm(place)}
      />

      <ReminderMailsSheet
        open={mailsOpen}
        householdId={household.active.id}
        householdName={household.active.name}
        onClose={() => setMailsOpen(false)}
      />
    </div>
  )
}

function AppWithSavings() {
  const household = useHouseholdContext()
  return (
    <SavingsProvider householdId={household.active?.id ?? null} userId={household.userId}>
      <AppShell />
    </SavingsProvider>
  )
}

export default function App() {
  return (
    <BudgetCacheProvider>
      <HouseholdProvider>
        <AppWithSavings />
      </HouseholdProvider>
    </BudgetCacheProvider>
  )
}
