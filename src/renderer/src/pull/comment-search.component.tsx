import { useEffect, useRef } from 'react'
import { countOf } from '../common/format.util.ts'
import { isTyping } from '../common/keyboard.util.ts'

/** Filters the comments panel; `/` focuses it and Escape clears it. Shows the match count while searching. */
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
  useEffect(() => {
    const focusOnSlash = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || isTyping(event.target)) {
        return
      }
      event.preventDefault()
      input.current?.focus()
    }
    globalThis.addEventListener('keydown', focusOnSlash)
    return () => globalThis.removeEventListener('keydown', focusOnSlash)
  }, [])
  return (
    <div className="px-3 pb-2">
      <input
        ref={input}
        type="search"
        aria-label="Search comments"
        placeholder="Search comments  /"
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
