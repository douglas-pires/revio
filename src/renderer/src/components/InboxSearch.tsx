import { useRef, useState } from 'react'
import { useSlashToFocus } from '../hooks/useSlashToFocus'

const EXAMPLES: [string, string][] = [
  ['user-review-requested:@me', 'Requested from you directly'],
  ['team-review-requested:', 'Requested from one of your teams (slug or org/slug, * for any)'],
  ['review-requested:@me', 'Any open request (you or a team)'],
  ['repo:', 'One repository (owner/name or name)'],
  ['author:', 'Opened by someone'],
  ['is:stale', 'Also: is:draft, is:stacked, is:approved, is:changes-requested'],
  ['-is:bot', 'Threads: hide ones a bot spoke last in'],
  ['-is:draft', 'A leading minus excludes'],
]

/** The inbox search field: free text plus GitHub-style qualifiers, with a cheat sheet while it is empty. */
export function InboxSearch({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  useSlashToFocus(input)

  const insert = (qualifier: string) => {
    onChange(`${value.trim() ? `${value.trim()} ` : ''}${qualifier}${qualifier.endsWith(':') ? '' : ' '}`)
    requestAnimationFrame(() => input.current?.focus())
  }

  return (
    <div className="no-drag relative">
      <input
        ref={input}
        className="input w-80 py-1 pr-7 font-mono text-[12px]"
        placeholder="Search or filter, e.g. team-review-requested:web"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          onChange('')
          input.current?.blur()
        }}
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-line px-1 text-[10px] text-muted">/</kbd>
      {focused && !value.trim() && (
        <ul className="absolute top-full right-0 z-20 mt-1 w-[26rem] overflow-hidden rounded-md border border-line bg-panel py-1 shadow-lg">
          {EXAMPLES.map(([qualifier, hint]) => (
            <li key={qualifier}>
              <button
                className="flex w-full items-baseline gap-3 px-3 py-1 text-left hover:bg-hover"
                // Keep focus in the field so the click lands before the list closes.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(qualifier)}
              >
                <code className="shrink-0 text-[12px] text-fg">{qualifier}</code>
                <span className="truncate text-[11.5px] text-muted">{hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
