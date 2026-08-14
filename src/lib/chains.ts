import type { MarketChain, MarketChainId } from '../types/budget'

export const KNOWN_CHAINS: MarketChain[] = [
  { id: 'bim', name: 'BİM', color: '#E30613' },
  { id: 'sok', name: 'Şok', color: '#FFCC00' },
  { id: 'a101', name: 'A101', color: '#00A651' },
  { id: 'migros', name: 'Migros', color: '#FF6600' },
  { id: 'carrefour', name: 'CarrefourSA', color: '#004E9A' },
  { id: 'tarim_kredi', name: 'Tarım Kredi', color: '#2E7D32' },
  { id: 'file', name: 'File', color: '#6A1B9A' },
]

const KNOWN: Record<string, MarketChain> = Object.fromEntries(
  KNOWN_CHAINS.map((c) => [c.id, c]),
)

export function normalizeChainId(raw: string): MarketChainId {
  const key = raw.trim().toLocaleLowerCase('tr').replace(/\s+/g, '_')
  if (key.includes('bim')) return 'bim'
  if (key.includes('sok') || key.includes('şok')) return 'sok'
  if (key.includes('a101')) return 'a101'
  if (key.includes('migros')) return 'migros'
  if (key.includes('carrefour')) return 'carrefour'
  if (key.includes('tarim') || key.includes('tarım')) return 'tarim_kredi'
  if (key.includes('file')) return 'file'
  if (key === 'other' || key === 'diger' || key === 'diğer') return 'other'
  return key || 'other'
}

export function chainById(id: MarketChainId): MarketChain {
  if (id === 'other' || id === 'diger') {
    return { id: 'other', name: 'Diğer', color: '#5B6B63' }
  }
  return (
    KNOWN[id] ?? {
      id,
      name: id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      color: '#0F3D2E',
    }
  )
}

export function formatChainName(raw: string): string {
  return chainById(normalizeChainId(raw)).name
}

/** “Nereden aldın?” seçenekleri — bilinen marketler + Diğer */
export function purchasePlaceOptions(): { id: string; label: string; color: string }[] {
  return [
    ...KNOWN_CHAINS.map((c) => ({ id: c.id, label: c.name, color: c.color })),
    { id: 'other', label: 'Diğer', color: '#5B6B63' },
  ]
}
