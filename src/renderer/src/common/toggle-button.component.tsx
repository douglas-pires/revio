import type { ReactNode } from 'react'
import { joinClassNames } from './format.util.ts'

/** A borderless button that stays highlighted while its option is on, e.g. Blame or Show resolved. */
export function ToggleButton(props: {
  on: boolean
  onToggle: () => void
  title?: string
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={props.on}
      title={props.title}
      onClick={props.onToggle}
      className={joinClassNames(
        'no-drag shrink-0 rounded px-2 py-0.5 text-[12px] whitespace-nowrap',
        props.on && 'bg-hover text-fg',
        !props.on && 'text-muted hover:text-fg',
        props.className,
      )}
    >
      {props.children}
    </button>
  )
}
