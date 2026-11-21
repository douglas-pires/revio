import { type KeyboardEvent, useEffect, useId, useMemo, useState } from 'react'
import { joinClassNames } from './format.util.ts'
import { type RankedMatch, rankFuzzyMatches } from './fuzzy-match.util.ts'
import { FuzzyText } from './fuzzy-text.component.tsx'

/** Suggestions shown at once. */
const SUGGESTION_LIMIT = 8

/** The suggestion after (or before) the active one, wrapping around; -1 is "none", where typing goes on. */
function stepActive(active: number, step: number, count: number) {
  if (count === 0) {
    return -1
  }
  return (active + step + count) % count
}

/** Arrow keys move through the suggestions, Enter applies one, Escape undoes the typing. */
function useSuggestionKeys(props: {
  suggestionCount: number
  active: number
  setActive: (active: number) => void
  applyActive: () => void
  revert: () => void
}) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      let step = 1
      if (event.key === 'ArrowUp') {
        step = -1
      }
      props.setActive(stepActive(props.active, step, props.suggestionCount))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      props.applyActive()
    } else if (event.key === 'Escape') {
      props.revert()
    }
  }
}

/** The suggestions under the input, the letters each matched marked; the active one is highlighted. */
function SuggestionList(props: {
  id: string
  label: string
  ranked: readonly RankedMatch<string>[]
  active: number
  onPick: (value: string) => void
}) {
  return (
    <div
      id={props.id}
      role="listbox"
      aria-label={`${props.label} suggestions`}
      className="absolute top-full left-0 z-20 mt-1 max-h-64 w-max max-w-[32rem] min-w-full overflow-y-auto rounded-md border border-line bg-panel py-1 shadow-lg"
    >
      {props.ranked.map((match, index) => (
        <div
          key={match.item}
          role="option"
          tabIndex={-1}
          aria-selected={index === props.active}
          className={joinClassNames(
            'cursor-default truncate px-2.5 py-1 font-mono text-[12px]',
            index === props.active && 'bg-accent/15 text-fg',
            index !== props.active && 'text-muted hover:bg-hover hover:text-fg',
          )}
          title={match.item}
          // Picking happens on mouse down, before the input's blur would apply the draft instead.
          onMouseDown={(event) => {
            event.preventDefault()
            props.onPick(match.item)
          }}
        >
          <FuzzyText text={match.item} positions={match.positions} />
        </div>
      ))}
    </div>
  )
}

/**
 * A filter input that suggests values as you type, matched fuzzily (letters in order, as fzf does) and best first.
 * What you type is a draft: the filter changes (`onCommit`) when you pick a suggestion, press Enter or leave the
 * field, so half-typed text is never searched for. Clearing the field clears the filter at once.
 */
export function FuzzyInput(props: {
  value: string
  onCommit: (value: string) => void
  suggestions: readonly string[]
  placeholder: string
  label: string
  className?: string
}) {
  const [draft, setDraft] = useState(props.value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  useEffect(() => setDraft(props.value), [props.value])
  const ranked = useMemo(
    () => rankFuzzyMatches(draft, props.suggestions, (suggestion) => suggestion, SUGGESTION_LIMIT),
    [draft, props.suggestions],
  )
  const listId = useId()
  const listOpen = open && ranked.length > 0
  const commit = (value: string) => {
    setDraft(value)
    setOpen(false)
    setActive(-1)
    if (value !== props.value) {
      props.onCommit(value)
    }
  }
  const onKeyDown = useSuggestionKeys({
    suggestionCount: ranked.length,
    active,
    setActive,
    // Enter takes the highlighted suggestion, else the best one, else the text as typed (a path not suggested).
    applyActive: () => commit(ranked[active]?.item ?? ranked[0]?.item ?? draft.trim()),
    revert: () => {
      setDraft(props.value)
      setOpen(false)
    },
  })
  return (
    <div className={joinClassNames('relative', props.className)}>
      <input
        type="search"
        className="input w-full py-1 text-[12px]"
        placeholder={props.placeholder}
        aria-label={props.label}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={listOpen}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setOpen(true)
          setActive(-1)
          if (event.target.value === '') {
            commit('')
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => commit(draft.trim())}
        onKeyDown={onKeyDown}
      />
      {Boolean(listOpen) && (
        <SuggestionList id={listId} label={props.label} ranked={ranked} active={active} onPick={commit} />
      )}
    </div>
  )
}
