import type { ReactNode } from 'react'
import { cx } from './format.util.ts'

export interface InnerTab<T extends string> {
  value: T
  label: string
  /** A count shown in a pill after the label. */
  count?: number | undefined
}

/**
 * Underlined tabs that switch what a screen shows inside it (e.g. a PR's Overview / Files changed / Commits), with
 * room on the right for tools. The bar and the tabs keep one height and padding whatever the tab or the bar's
 * width, so switching never moves them.
 */
export function InnerTabs<T extends string>(props: {
  tabs: readonly InnerTab<T>[]
  value: T
  onChange: (value: T) => void
  /** Tools on the right, centred on the tab labels; they never change the bar's height. */
  children?: ReactNode
}) {
  return (
    // A size container, so the tools can fit themselves to the bar's width (narrower beside a side panel).
    <div role="tablist" className="@container flex h-11 shrink-0 items-end gap-1 border-b border-line px-4">
      {props.tabs.map((t) => (
        <button
          type="button"
          role="tab"
          aria-selected={props.value === t.value}
          key={t.value}
          onClick={() => props.onChange(t.value)}
          className={cx(
            '-mb-px flex h-9 shrink-0 items-center border-b-2 px-3 font-medium whitespace-nowrap',
            props.value === t.value && 'border-accent text-fg',
            props.value !== t.value && 'border-transparent text-muted hover:text-fg',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="ml-1.5 rounded-full bg-panel-2 px-1.5 text-[11px] text-muted">{t.count}</span>
          )}
        </button>
      ))}
      {Boolean(props.children) && <div className="ml-auto flex h-9 min-w-0 items-center">{props.children}</div>}
    </div>
  )
}
