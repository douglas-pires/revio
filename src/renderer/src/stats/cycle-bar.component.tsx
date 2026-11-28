import { formatSpan } from './stats-format.util.ts'
import type { ComputedStats } from './stats-summary.util.ts'

/** The four stretches of cycle time, in the categorical order the chart colors follow. */
const STRETCHES = [
  { key: 'codingMs', label: 'Coding', hint: 'first commit to opened for review', color: 'var(--color-series-1)' },
  { key: 'waitingMs', label: 'Waiting for review', hint: 'opened to first review', color: 'var(--color-series-2)' },
  { key: 'reviewingMs', label: 'In review', hint: 'first review to approval', color: 'var(--color-series-3)' },
  { key: 'mergingMs', label: 'Waiting to merge', hint: 'approval to merge', color: 'var(--color-series-4)' },
] as const

/** The median cycle time split into its stretches: one bar, and a legend with each stretch's median. */
export function CycleBar({ cycle, merged }: { cycle: ComputedStats['cycle']; merged: number }) {
  const total = STRETCHES.reduce((sum, stretch) => sum + cycle[stretch.key], 0)
  return (
    <figure className="card flex flex-col gap-3 p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-medium">Where cycle time goes</span>
        <span className="text-[12px] text-muted">median of {merged} merged PRs, first commit to merge</span>
      </figcaption>
      {total > 0 && (
        <div className="flex h-4 gap-[2px]">
          {STRETCHES.filter((stretch) => cycle[stretch.key] > 0).map((stretch) => (
            <div
              key={stretch.key}
              title={`${stretch.label}: ${formatSpan(cycle[stretch.key])}`}
              className="first:rounded-l last:rounded-r"
              style={{ flexGrow: cycle[stretch.key], background: stretch.color }}
            />
          ))}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] md:grid-cols-4">
        {STRETCHES.map((stretch) => (
          <li key={stretch.key} className="flex items-start gap-2">
            <span className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ background: stretch.color }} />
            <span>
              <span className="block text-fg">
                {stretch.label} <span className="font-mono">{formatSpan(cycle[stretch.key])}</span>
              </span>
              <span className="block text-muted">{stretch.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
