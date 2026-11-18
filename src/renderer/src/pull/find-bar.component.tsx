import { useEffect, useRef } from 'react'
import { cx } from '../common/format.util'
import { MAX_MATCHES } from './diff-search.util'
import type { useDiffFind } from './use-diff-find.hook'

/** The ⌘F bar above the changed files: the search text, where you are among the matches, and the controls. */
export function FindBar({ find }: { find: ReturnType<typeof useDiffFind> }) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [find.focusTick])
  const count = find.matches.length
  const total = count >= MAX_MATCHES ? `${MAX_MATCHES}+` : `${count}`
  const status = !find.query ? '' : count === 0 ? 'No results' : find.index == null ? `${total} ${count === 1 ? 'match' : 'matches'}` : `${find.index + 1} of ${total}`
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line bg-panel-2 px-4 py-1.5">
      <input
        ref={input}
        className="input h-7 max-w-80 py-0 font-mono text-[12px]"
        placeholder="Find in changed files"
        aria-label="Find in changed files"
        value={find.query}
        onChange={(e) => find.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) find.previous()
            else find.next()
          } else if (e.key === 'Escape') find.close()
        }}
      />
      <button
        className={cx('btn btn-ghost px-1.5 py-0 font-mono text-[12px]', find.caseSensitive ? 'bg-hover text-fg' : 'text-muted')}
        title="Match case"
        aria-pressed={find.caseSensitive}
        onClick={() => find.setCaseSensitive(!find.caseSensitive)}
      >
        Aa
      </button>
      <span className={cx('min-w-20 text-[12px] whitespace-nowrap', count === 0 && find.query ? 'text-danger' : 'text-muted')} aria-live="polite">
        {status}
      </span>
      <button className="btn btn-ghost px-1.5 py-0" title="Previous match (⇧↵ or ⇧⌘G)" aria-label="Previous match" disabled={!count} onClick={find.previous}>
        ↑
      </button>
      <button className="btn btn-ghost px-1.5 py-0" title="Next match (↵ or ⌘G)" aria-label="Next match" disabled={!count} onClick={find.next}>
        ↓
      </button>
      <div className="flex-1" />
      <button className="btn btn-ghost px-1.5 py-0 text-muted" title="Close (Esc)" aria-label="Close find" onClick={find.close}>
        ✕
      </button>
    </div>
  )
}
