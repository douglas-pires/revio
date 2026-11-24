import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { joinClassNames } from './format.util.ts'
import { stepResult } from './step-result.util.ts'

const STEPS: Record<string, 1 | -1> = { ArrowDown: 1, ArrowUp: -1 }

/** Opens as a modal, and keeps the highlighted row in view. */
function usePickerDialog(active: number, count: number) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new active row or result list is the trigger to scroll it into view.
  useEffect(() => {
    dialog.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, count])
  return dialog
}

/** One row; picked on mouse down, so the search box keeps the focus. */
function PickerRow(props: { active: boolean; title: string; onPick: () => void; children: ReactNode }) {
  return (
    <div
      role="option"
      tabIndex={-1}
      aria-selected={props.active}
      data-active={props.active}
      title={props.title}
      className={joinClassNames(
        'flex cursor-default items-baseline gap-2 px-3 py-1.5 text-[12.5px]',
        props.active && 'bg-accent/15 text-fg',
        !props.active && 'text-muted hover:bg-hover hover:text-fg',
      )}
      onMouseDown={(event) => {
        event.preventDefault()
        props.onPick()
      }}
    >
      {props.children}
    </div>
  )
}

interface PickerDialogProps<T> {
  label: string
  placeholder: string
  emptyText: string
  query: string
  onQuery: (query: string) => void
  /** What matches the query, best first. */
  results: readonly T[]
  readKey: (result: T) => string
  readTitle: (result: T) => string
  renderRow: (result: T) => ReactNode
  onPick: (result: T) => void
  onClose: () => void
}

/**
 * A list to pick from by typing: arrows move through the results and Enter picks. A modal <dialog>, so Escape and
 * clicks outside close it and focus comes back where it was.
 */
export function PickerDialog<T>(props: PickerDialogProps<T>) {
  const { results } = props
  const [active, setActive] = useState(0)
  const dialog = usePickerDialog(active, results.length)
  const listId = useId()
  const pick = (result: T | undefined) => {
    if (result !== undefined) {
      props.onClose()
      props.onPick(result)
    }
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const step = STEPS[event.key]
    if (step !== undefined) {
      event.preventDefault()
      setActive(stepResult(active, step, results.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      pick(results[active])
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-label={props.label}
      className="mx-auto mt-24 w-[min(640px,90vw)] overflow-hidden rounded-lg border border-line bg-panel p-0 text-fg shadow-2xl backdrop:bg-black/40"
      onClose={props.onClose}
      onMouseDown={(event) => event.target === event.currentTarget && dialog.current?.close()}
    >
      <input
        className="w-full border-b border-line bg-transparent px-4 py-3 font-mono text-[13px] outline-none"
        placeholder={props.placeholder}
        aria-label={props.label}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={true}
        value={props.query}
        onChange={(event) => {
          props.onQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
      />
      <div id={listId} role="listbox" aria-label={props.label} className="max-h-[50vh] overflow-y-auto py-1">
        {results.map((result, index) => (
          <PickerRow
            key={props.readKey(result)}
            active={index === active}
            title={props.readTitle(result)}
            onPick={() => pick(result)}
          >
            {props.renderRow(result)}
          </PickerRow>
        ))}
        {results.length === 0 && <div className="px-4 py-3 text-[12.5px] text-muted">{props.emptyText}</div>}
      </div>
    </dialog>
  )
}
