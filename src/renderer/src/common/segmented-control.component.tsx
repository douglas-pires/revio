import { joinClassNames } from './format.util.ts'

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
    <div className={joinClassNames('no-drag flex shrink-0 rounded-md border border-line p-0.5', props.className)}>
      {props.segments.map((segment) => (
        <button
          type="button"
          aria-pressed={props.value === segment.value}
          key={segment.value}
          title={segment.title}
          onClick={() => props.onChange(segment.value)}
          className={joinClassNames(
            'rounded px-2.5 py-0.5 text-[12px] whitespace-nowrap',
            props.value === segment.value && 'bg-hover text-fg',
            props.value !== segment.value && 'text-muted hover:text-fg',
          )}
        >
          {segment.label}
        </button>
      ))}
    </div>
  )
}
