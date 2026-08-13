import { useState } from 'react'
import { FamilyBar } from './components/FamilyBar'
import { HouseholdGate } from './components/HouseholdGate'
import { ItemForm } from './components/ItemForm'
import { ItemRow } from './components/ItemRow'
import { useHousehold } from './hooks/useHousehold'
import { useItems } from './hooks/useItems'
import type { FilterId, StockItem } from './types'
import './App.css'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'pending', label: 'Alınacak' },
  { id: 'done', label: 'Alındı' },
  { id: 'overdue', label: 'Geciken' },
]

export default function App() {
  const household = useHousehold()
  const {
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

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StockItem | null>(null)
  const [extraGate, setExtraGate] = useState<'create' | 'join' | null>(null)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(item: StockItem) {
    setEditing(item)
    setFormOpen(true)
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
    <div className="app">
      <div className="bg-glow" aria-hidden />

      <header className="top">
        <div className="brand-block">
          <p className="brand">Ev Stok</p>
          <p className="tagline">Sadece sizin ailenizin listesi</p>
        </div>
        <span className={`sync-pill${syncError ? ' err' : ''}`}>
          {syncError ? 'Senkron hata' : 'Bulut açık'}
        </span>
      </header>

      <FamilyBar
        active={household.active}
        households={household.households}
        onSelect={household.select}
        onLeave={household.leaveActive}
        onCreateRequest={() => setExtraGate('create')}
        onJoinRequest={() => setExtraGate('join')}
      />

      {syncError ? <div className="banner err">{syncError}</div> : null}

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
                onToggle={() => togglePurchased(item.id)}
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
    </div>
  )
}
