import type { ReactNode } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { usePalettePage } from '../palette/use-palette-page.hook.ts'

/** The settings' categories, as listed: what each is called and what is in it. */
const CATEGORIES = {
  github: { label: 'GitHub', hint: 'Account and which PRs count' },
  alerts: { label: 'Alerts', hint: 'Notifications and stale reviews' },
  focus: { label: 'Focus', hint: 'Review blocks' },
  editor: { label: 'Editor', hint: 'Opening files on this Mac' },
  shortcuts: { label: 'Shortcuts', hint: 'Every shortcut and its keys' },
  claude: { label: 'Claude', hint: 'Connection and model' },
  sync: { label: 'Sync', hint: 'Your other Macs' },
  updates: { label: 'Updates', hint: 'This version of Revio' },
  feedback: { label: 'Feedback', hint: 'Bugs and ideas' },
} as const

export type SettingsCategory = keyof typeof CATEGORIES

export const SETTINGS_CATEGORIES = Object.keys(CATEGORIES) as SettingsCategory[]

/** The categories down the left side; the open one is highlighted. */
export function CategoryNav({
  active,
  onPick,
}: {
  active: SettingsCategory
  onPick: (category: SettingsCategory) => void
}) {
  return (
    <nav
      aria-label="Settings categories"
      className="w-56 shrink-0 space-y-0.5 overflow-y-auto border-r border-line bg-panel p-2"
    >
      {SETTINGS_CATEGORIES.map((category) => (
        <button
          type="button"
          key={category}
          aria-current={category === active}
          className={joinClassNames(
            'block w-full rounded-md px-3 py-1.5 text-left',
            category === active && 'bg-hover text-fg',
            category !== active && 'text-muted hover:bg-hover/60 hover:text-fg',
          )}
          onClick={() => onPick(category)}
        >
          <span className="block font-medium">{CATEGORIES[category].label}</span>
          <span className="block truncate text-[11.5px] text-muted">{CATEGORIES[category].hint}</span>
        </button>
      ))}
    </nav>
  )
}

/** The settings' actions in the palette: going to each category. */
export function CategoryActions({ onPick }: { onPick: (category: SettingsCategory) => void }) {
  usePalettePage({
    name: 'Settings',
    actions: SETTINGS_CATEGORIES.map((category) => ({
      id: category,
      label: `Show ${CATEGORIES[category].label} settings`,
      run: () => onPick(category),
    })),
  })
  return null
}

/** One category's settings; it stays mounted while another is open, so what you typed in it is not lost. */
export function CategoryPane({
  category,
  active,
  children,
}: {
  category: SettingsCategory
  active: SettingsCategory
  children: ReactNode
}) {
  return (
    <section
      aria-label={CATEGORIES[category].label}
      hidden={category !== active}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="mx-auto max-w-2xl space-y-3 px-5 py-4">
        <h2 className="text-[15px] font-semibold">{CATEGORIES[category].label}</h2>
        {children}
      </div>
    </section>
  )
}
