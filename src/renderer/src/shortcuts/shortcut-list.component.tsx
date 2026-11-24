import { formatShortcut } from '@shared/shortcut.util.ts'
import { SHORTCUT_ACTIONS, type ShortcutAction } from '@shared/shortcut-actions.util.ts'
import { useState } from 'react'
import { matchFuzzy } from '../common/fuzzy-match.util.ts'
import { groupBy } from '../common/group.util.ts'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { ShortcutEditor } from './shortcut-editor.component.tsx'
import { useShortcuts } from './shortcuts.context.ts'

/** Shortcuts of macOS menus and text fields, listed but not changed here. */
const FIXED_SHORTCUTS = [
  { label: 'Back', shortcut: 'Cmd+[' },
  { label: 'Forward', shortcut: 'Cmd+]' },
  { label: 'Close a box, keeping what you wrote', shortcut: 'Escape' },
]

/** Whether the search finds it by name or by its keys. */
function matchesSearch(query: string, label: string, shortcut: string) {
  const keys = formatShortcut(shortcut).toLowerCase()
  return matchFuzzy(query, label) !== null || keys.includes(query.trim().toLowerCase())
}

function ActionRow({ action }: { action: ShortcutAction }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 px-4 py-2">
      <span>{action.label}</span>
      <ShortcutEditor action={action.id} className="contents" popoverClassName="mt-2 w-full" />
    </li>
  )
}

/** Shortcuts you can change, under where they work. */
function ActionGroups({ actions }: { actions: readonly ShortcutAction[] }) {
  return [...groupBy(actions, (action) => action.group)].map(([group, groupActions]) => (
    <section key={group}>
      <SectionHeading title={group} />
      <ul className="card divide-y divide-line">
        {groupActions.map((action) => (
          <ActionRow key={action.id} action={action} />
        ))}
      </ul>
    </section>
  ))
}

/** Shortcuts that are always the same. */
function FixedShortcuts({ query }: { query: string }) {
  const shown = FIXED_SHORTCUTS.filter(({ label, shortcut }) => matchesSearch(query, label, shortcut))
  if (shown.length === 0) {
    return null
  }
  return (
    <section>
      <SectionHeading title="Always the same" />
      <ul className="card divide-y divide-line">
        {shown.map(({ label, shortcut }) => (
          <li key={label} className="flex items-center justify-between px-4 py-2 text-muted">
            <span>{label}</span>
            <kbd className="kbd">{formatShortcut(shortcut)}</kbd>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Every shortcut, searched by name or keys; click the keys to change them. */
export function ShortcutList() {
  const { shortcuts, resetAll } = useShortcuts()
  const [query, setQuery] = useState('')
  const shownActions = SHORTCUT_ACTIONS.filter(({ id, label }) => matchesSearch(query, label, shortcuts[id]))
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <input
          type="search"
          className="input"
          placeholder="Search shortcuts"
          aria-label="Search shortcuts"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="btn btn-ghost shrink-0" onClick={resetAll}>
          Reset all
        </button>
      </div>
      <ActionGroups actions={shownActions} />
      <FixedShortcuts query={query} />
    </div>
  )
}
