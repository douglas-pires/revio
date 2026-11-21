import { joinClassNames } from './format.util.ts'

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f']

/** Grey pulsing rows shown while a list loads, as tall as its real rows. */
export function ListSkeleton({
  rows,
  rowHeight = 'h-14',
  onPanel = false,
}: {
  rows: number
  rowHeight?: string
  /** Drawn on a panel (a sidebar), so the rows take a lighter grey to show. */
  onPanel?: boolean
}) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      {ROW_KEYS.slice(0, rows).map((rowKey) => (
        <div
          key={rowKey}
          className={joinClassNames(
            'animate-pulse rounded-lg',
            rowHeight,
            onPanel && 'bg-panel-2',
            !onPanel && 'bg-panel',
          )}
        />
      ))}
    </div>
  )
}
