import type { ReactNode } from 'react'
import { cx } from './format.util.ts'

/** A selectable red box for an error message. Renders nothing without one. */
export function ErrorBanner({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) {
    return null
  }
  return (
    <div className={cx('selectable rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-danger', className)}>
      {children}
    </div>
  )
}
