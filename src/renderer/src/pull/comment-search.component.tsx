import { formatShortcut } from '@shared/shortcut.util.ts'
import { useRef } from 'react'
import { countOf } from '../common/format.util.ts'
import { useShortcuts } from '../shortcuts/shortcuts.context.ts'
import { useShortcut } from '../shortcuts/use-shortcut.hook.ts'

/** Filters the comments panel; its shortcut focuses it and Escape clears it. Shows the match count while searching. */
export function CommentSearch({
  query,
  onChange,
  matches,
}: {
  query: string
  onChange: (query: string) => void
  matches: number | null
}) {
  const input = useRef<HTMLInputElement>(null)
  const { shortcuts } = useShortcuts()
  useShortcut('search', () => input.current?.focus())
  return (
    <div className="px-3 pb-2">
      <input
        ref={input}
        type="search"
        aria-label="Search comments"
        placeholder={`Search comments  ${formatShortcut(shortcuts.search)}`}
        className="input py-1 text-[12px]"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange('')
            event.currentTarget.blur()
          }
        }}
      />
      {matches !== null && <div className="mt-1 text-[11px] text-muted">{countOf(matches, 'match', 'matches')}</div>}
    </div>
  )
}
