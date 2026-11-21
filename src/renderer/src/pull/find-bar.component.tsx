import { useEffect, useRef } from 'react'
import { cx } from '../common/format.util.ts'
import { MAX_MATCHES } from './diff-search.util.ts'
import type { useDiffFind } from './use-diff-find.hook.ts'

type DiffFind = ReturnType<typeof useDiffFind>

/** "1000+" past the cap, else the count. */
function totalOf(count: number) {
  if (count >= MAX_MATCHES) {
    return `${MAX_MATCHES}+`
  }
  return `${count}`
}

function matchWord(count: number) {
  if (count === 1) {
    return 'match'
  }
  return 'matches'
}

/** Where you are among the matches: nothing before a query, "No results", "12 matches" or "3 of 12". */
function findStatus(query: string, count: number, index: number | null) {
  if (!query) {
    return ''
  }
  if (count === 0) {
    return 'No results'
  }
  if (index === null) {
    return `${totalOf(count)} ${matchWord(count)}`
  }
  return `${index + 1} of ${totalOf(count)}`
}

/** Enter steps forward, ⇧Enter back, Escape closes. */
function onFindKey(event: React.KeyboardEvent, find: DiffFind) {
  if (event.key === 'Enter') {
    event.preventDefault()
    if (event.shiftKey) {
      find.previous()
    } else {
      find.next()
    }
  } else if (event.key === 'Escape') {
    find.close()
  }
}

/** Previous, next and close. */
function FindSteps({ find, hasMatches }: { find: DiffFind; hasMatches: boolean }) {
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost px-1.5 py-0"
        title="Previous match (⇧↵ or ⇧⌘G)"
        aria-label="Previous match"
        disabled={!hasMatches}
        onClick={find.previous}
      >
        ↑
      </button>
      <button
        type="button"
        className="btn btn-ghost px-1.5 py-0"
        title="Next match (↵ or ⌘G)"
        aria-label="Next match"
        disabled={!hasMatches}
        onClick={find.next}
      >
        ↓
      </button>
      <div className="flex-1" />
      <button
        type="button"
        className="btn btn-ghost px-1.5 py-0 text-muted"
        title="Close (Esc)"
        aria-label="Close find"
        onClick={find.close}
      >
        ✕
      </button>
    </>
  )
}

/** The ⌘F bar above the changed files: the search text, where you are among the matches, and the controls. */
export function FindBar({ find }: { find: DiffFind }) {
  const input = useRef<HTMLInputElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusTick is the trigger; each ⌘F selects the search text again.
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [find.focusTick])
  const count = find.matches.length
  const status = findStatus(find.query, count, find.index)
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line bg-panel-2 px-4 py-1.5">
      <input
        ref={input}
        className="input h-7 max-w-80 py-0 font-mono text-[12px]"
        placeholder="Find in changed files"
        aria-label="Find in changed files"
        value={find.query}
        onChange={(event) => find.setQuery(event.target.value)}
        onKeyDown={(event) => onFindKey(event, find)}
      />
      <button
        type="button"
        className={cx(
          'btn btn-ghost px-1.5 py-0 font-mono text-[12px]',
          find.caseSensitive && 'bg-hover text-fg',
          !find.caseSensitive && 'text-muted',
        )}
        title="Match case"
        aria-pressed={find.caseSensitive}
        onClick={() => find.setCaseSensitive(!find.caseSensitive)}
      >
        Aa
      </button>
      <span
        className={cx(
          'min-w-20 text-[12px] whitespace-nowrap',
          count === 0 && Boolean(find.query) && 'text-danger',
          !(count === 0 && find.query) && 'text-muted',
        )}
        aria-live="polite"
      >
        {status}
      </span>
      <FindSteps find={find} hasMatches={count > 0} />
    </div>
  )
}
