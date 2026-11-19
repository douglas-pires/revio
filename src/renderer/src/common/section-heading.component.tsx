import { cx } from './format.util.ts'

/** The small uppercase heading above a list: title, count and an optional hint. */
export function SectionHeading({
  title,
  count,
  hint,
  tone,
}: {
  title: string
  count: number
  hint?: string | undefined
  tone?: 'accent' | 'danger' | undefined
}) {
  return (
    <h2 className="mb-2 flex items-baseline gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
      <span className={cx(tone === 'accent' && 'text-accent', tone === 'danger' && 'text-danger')}>{title}</span>
      <span className="font-normal normal-case">{count}</span>
      {Boolean(hint) && <span className="font-normal tracking-normal normal-case">· {hint}</span>}
    </h2>
  )
}
