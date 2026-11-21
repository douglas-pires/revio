import type { GapMarker, HunkHeader } from './diff.util.ts'

import { EXPAND_STEP, type ExpandDirection } from './diff-expand.util.ts'

function formatHiddenLines(count: number | null) {
  if (count === 1) {
    return 'the hidden line'
  }
  return `all ${count} hidden lines`
}

const ARROWS: Record<ExpandDirection, { icon: string; title: (hiddenCount: number | null) => string }> = {
  up: { icon: '↑', title: () => `Show ${EXPAND_STEP} more lines above` },
  down: { icon: '↓', title: () => `Show ${EXPAND_STEP} more lines below` },
  all: { icon: '↕', title: (count) => `Show ${formatHiddenLines(count)}` },
}

/** Which buttons a separator offers: one when little is hidden, else the directions that make sense where it sits. */
function listExpandDirections(gap: NonNullable<HunkHeader['gap']>): ExpandDirection[] {
  if (gap.hidden !== null && gap.hidden <= EXPAND_STEP) {
    return ['all']
  }
  if (gap.first) {
    return ['up']
  }
  if (gap.last) {
    return ['down']
  }
  return ['down', 'up']
}

/** What a gap row says when it has no hunk header: how many lines it hides. */
function describeHiddenLines(gap: GapMarker | undefined) {
  if (gap === undefined) {
    return ''
  }
  if (gap.hidden === null) {
    return 'Rest of the file'
  }
  if (gap.hidden === 1) {
    return '1 more line'
  }
  return `${gap.hidden} more lines`
}

function ExpandButtons({
  gap,
  onExpand,
}: {
  gap: GapMarker
  onExpand: (gap: number, direction: ExpandDirection) => void
}) {
  return (
    <span className="flex shrink-0 flex-col border-r border-line select-none">
      {listExpandDirections(gap).map((direction) => (
        <button
          type="button"
          key={direction}
          className="flex-1 px-3 leading-[18px] hover:bg-accent/20 hover:text-fg"
          title={ARROWS[direction].title(gap.hidden)}
          aria-label={ARROWS[direction].title(gap.hidden)}
          onClick={() => onExpand(gap.index, direction)}
        >
          {ARROWS[direction].icon}
        </button>
      ))}
    </span>
  )
}

/** A hunk header, or the line marking hidden code between hunks, with buttons to show more of the file. */
export function HunkRow({
  row,
  span,
  onExpand,
}: {
  row: HunkHeader
  span: number
  onExpand?: ((gap: number, direction: ExpandDirection) => void) | undefined
}) {
  return (
    <tr className="bg-hunk text-muted">
      <td colSpan={span} className="py-0 select-text">
        <div className="flex items-stretch">
          {row.gap !== undefined && onExpand !== undefined && <ExpandButtons gap={row.gap} onExpand={onExpand} />}
          <span className="min-w-0 flex-1 self-center px-3 py-0.5">
            {row.text || describeHiddenLines(onExpand && row.gap)}
          </span>
        </div>
      </td>
    </tr>
  )
}
