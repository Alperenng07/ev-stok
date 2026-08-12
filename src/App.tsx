import { useState } from 'react'
import { ItemForm } from './components/ItemForm'
import { ItemRow } from './components/ItemRow'
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
  const {
    filtered,
    filter,
    setFilter,
    query,
    setQuery,
    stats,
    addItem,
    updateItem,
    removeItem,
    togglePurchased,
  } = useItems()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StockItem | null>(null)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(item: StockItem) {
    setEditing(item)
    setFormOpen(true)
  }

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden />

      <header className="top">
        <div className="brand-block">
          <p className="brand">Ev Stok</p>
          <p className="tagline">Eksikler ve yenilemeler tek yerde</p>
        </div>
      </header>

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
        {filtered.length === 0 ? (
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
        onDelete={editing ? () => removeItem(editing.id) : undefined}
      />
    </div>
  )
}
