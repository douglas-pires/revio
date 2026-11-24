import { formatShortcut } from '@shared/shortcut.util.ts'
import { useMemo, useState } from 'react'
import { type RankedMatch, rankFuzzyMatches } from '../common/fuzzy-match.util.ts'
import { FuzzyText } from '../common/fuzzy-text.component.tsx'
import { PickerDialog } from '../common/picker-dialog.component.tsx'
import { useShortcuts } from '../shortcuts/shortcuts.context.ts'
import { useShortcut } from '../shortcuts/use-shortcut.hook.ts'
import type { PaletteEntry } from './palette.types.ts'
import { listPaletteEntries } from './palette-pages.service.ts'

/** Actions listed at once. */
const RESULT_LIMIT = 50

/** An action: its name with what matched marked, its page, and the keys that do the same. */
function EntryRow({ match }: { match: RankedMatch<PaletteEntry> }) {
  const { shortcuts } = useShortcuts()
  const { label, page, shortcut } = match.item
  return (
    <>
      <span className="text-fg">
        <FuzzyText text={label} positions={match.positions} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px]">{page}</span>
      {shortcut !== undefined && shortcuts[shortcut] !== '' && (
        <kbd className="kbd">{formatShortcut(shortcuts[shortcut])}</kbd>
      )}
    </>
  )
}

function OpenPalette({ onClose }: { onClose: () => void }) {
  const [entries] = useState(listPaletteEntries)
  const [query, setQuery] = useState('')
  const results = useMemo(() => rankFuzzyMatches(query, entries, ({ label }) => label, RESULT_LIMIT), [query, entries])
  return (
    <PickerDialog
      label="Actions"
      placeholder="What do you want to do?"
      emptyText="No action matches."
      query={query}
      onQuery={setQuery}
      results={results}
      readKey={({ item }) => `${item.page}:${item.id}`}
      readTitle={({ item }) => item.label}
      renderRow={(match) => <EntryRow match={match} />}
      // Once the palette is gone, so an action that opens a dialog or moves the focus has the screen to itself.
      onPick={({ item }) => setTimeout(item.run)}
      onClose={onClose}
    />
  )
}

/** What you can do on this screen, then anywhere: its shortcut (⌘K unless changed) opens and closes it. */
export function Palette() {
  const [open, setOpen] = useState(false)
  useShortcut('palette', () => setOpen(!open), { overDialogs: open })
  if (!open) {
    return null
  }
  return <OpenPalette onClose={() => setOpen(false)} />
}
