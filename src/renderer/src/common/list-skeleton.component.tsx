import { cx } from './format.util.ts'

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f']

/** Grey pulsing rows shown while a list loads, as tall as its real rows. */
export function ListSkeleton({ rows, rowHeight = 'h-14' }: { rows: number; rowHeight?: string }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      {ROW_KEYS.slice(0, rows).map((k) => (
        <div key={k} className={cx('animate-pulse rounded-lg bg-panel', rowHeight)} />
      ))}
    </div>
  )
}
