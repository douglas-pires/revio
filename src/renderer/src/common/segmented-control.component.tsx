import { cx } from './format.util.ts'

export interface Segment<T extends string> {
  value: T
  label: string
  title?: string
}

/** A row of mutually exclusive choices in one outlined box, e.g. Queue / Stacks / Threads or Unified / Split. */
export function SegmentedControl<T extends string>(props: {
  segments: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cx('no-drag flex shrink-0 rounded-md border border-line p-0.5', props.className)}>
      {props.segments.map((s) => (
        <button
          type="button"
          aria-pressed={props.value === s.value}
          key={s.value}
          title={s.title}
          onClick={() => props.onChange(s.value)}
          className={cx(
            'rounded px-2.5 py-0.5 text-[12px] whitespace-nowrap',
            props.value === s.value && 'bg-hover text-fg',
            props.value !== s.value && 'text-muted hover:text-fg',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
