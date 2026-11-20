import type { ReactNode } from 'react'
import { cx } from './format.util.ts'
import { HistoryArrows } from './history-arrows.component.tsx'

/**
 * The bar at the top of every screen: back/forward, the title (with a line under it when there is one), the screen's
 * own controls beside the title, and its actions on the right. One height and layout everywhere.
 */
export function ScreenHeader(props: {
  title: ReactNode
  subtitle?: ReactNode
  /** Before the title, e.g. the PR author's avatar. */
  leading?: ReactNode
  /** Beside the title: switches and filters that change what the screen shows. */
  children?: ReactNode
  /** On the right: refresh, save and the like. */
  actions?: ReactNode
}) {
  return (
    <header className="drag flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
      <HistoryArrows />
      {props.leading}
      <div className="min-w-0 shrink">
        <h1 className="selectable no-drag truncate text-[14px] leading-5 font-semibold">{props.title}</h1>
        {Boolean(props.subtitle) && <div className="truncate text-[12px] leading-4 text-muted">{props.subtitle}</div>}
      </div>
      {props.children}
      <div className="flex-1" />
      {Boolean(props.actions) && <div className="no-drag flex shrink-0 items-center gap-2">{props.actions}</div>}
    </header>
  )
}

/** The scrolling area under a screen header, with the same padding on every screen; `narrow` centres a column. */
export function ScreenBody({ narrow = false, children }: { narrow?: boolean; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={cx('px-5 py-4', narrow && 'mx-auto max-w-2xl')}>{children}</div>
    </div>
  )
}

/** A screen: its header, then its body. */
export function Screen({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      {header}
      {children}
    </div>
  )
}
