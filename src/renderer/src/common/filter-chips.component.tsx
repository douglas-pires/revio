import { cx } from './format.util.ts'

export interface FilterChip {
  key: string
  label: string
  count: number
  title?: string
  active: boolean
  onPick: () => void
}

/** A label and a row of rounded choices with counts, e.g. "Requested from  All 5  Me 4  @acme/frontend 1". */
export function FilterChips({ label, chips }: { label: string; chips: readonly FilterChip[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px]">
      <span className="mr-1 text-muted">{label}</span>
      {chips.map((chip) => (
        <button
          type="button"
          key={chip.key}
          title={chip.title}
          aria-pressed={chip.active}
          onClick={chip.onPick}
          className={cx(
            'rounded-full border px-2.5 py-0.5 whitespace-nowrap',
            chip.active && 'border-accent bg-accent/15 text-accent',
            !chip.active && 'border-line text-muted hover:text-fg',
          )}
        >
          {chip.label} <span className="font-mono text-[11px] opacity-80">{chip.count}</span>
        </button>
      ))}
    </div>
  )
}
