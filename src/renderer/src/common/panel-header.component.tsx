import type { ReactNode } from 'react'

/** The top line of a side panel (files, comments, history, a Claude chat): its title, what follows, and ✕. */
export function PanelHeader(props: {
  title: string
  /** Right after the title: a count, a file name. */
  detail?: ReactNode
  /** On the right, before ✕. */
  actions?: ReactNode
  onClose?: () => void
  closeLabel?: string
}) {
  return (
    <div className="flex min-h-9 shrink-0 items-center gap-2 border-b border-line px-3 py-1.5 text-[12px] text-muted">
      <span className="shrink-0 font-semibold text-fg">{props.title}</span>
      {props.detail}
      <div className="flex-1" />
      {props.actions}
      {props.onClose !== undefined && (
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:bg-hover hover:text-fg"
          title={props.closeLabel}
          aria-label={props.closeLabel}
          onClick={props.onClose}
        >
          ✕
        </button>
      )}
    </div>
  )
}
