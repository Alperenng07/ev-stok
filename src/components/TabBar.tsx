import type { AppTab } from '../types'

const TABS: { id: AppTab; label: string }[] = [
  { id: 'list', label: 'Liste' },
  { id: 'budget', label: 'Bütçe' },
  { id: 'reports', label: 'Bilanço' },
  { id: 'family', label: 'Aile' },
  { id: 'profile', label: 'Profil' },
]

type Props = {
  active: AppTab
  onChange: (tab: AppTab) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tab-bar" aria-label="Ana sekmeler">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={active === tab.id ? 'tab active' : 'tab'}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
