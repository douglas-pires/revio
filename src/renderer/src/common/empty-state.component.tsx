import type { ReactNode } from 'react'

/** The dashed box a list shows when it has nothing in it: an optional title, a line of text and an action. */
export function EmptyState({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-muted">
      {Boolean(title) && <p className="mb-1 font-medium text-fg">{title}</p>}
      <div className="mx-auto max-w-md">{children}</div>
      {Boolean(action) && <div className="mt-4">{action}</div>}
    </div>
  )
}
