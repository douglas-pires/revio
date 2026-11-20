import type { ReactNode } from 'react'
import { cx } from './format.util.ts'

/** The heading above a list or group, in sentence case: title, count, an optional hint and an action on the right. */
export function SectionHeading({
  title,
  count,
  hint,
  tone,
  action,
  className = 'mb-2',
}: {
  title: string
  count?: number | undefined
  hint?: string | undefined
  tone?: 'accent' | 'danger' | undefined
  action?: ReactNode
  className?: string
}) {
  return (
    <h2 className={cx('flex items-baseline gap-2 text-[12px] font-semibold text-muted', className)}>
      <span className={cx(tone === 'accent' && 'text-accent', tone === 'danger' && 'text-danger')}>{title}</span>
      {count !== undefined && <span className="font-normal">{count}</span>}
      {Boolean(hint) && <span className="font-normal">· {hint}</span>}
      {Boolean(action) && <span className="ml-auto font-normal">{action}</span>}
    </h2>
  )
}
