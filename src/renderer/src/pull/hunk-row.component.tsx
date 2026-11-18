import type { HunkHeader } from './diff.util'
import { EXPAND_STEP, type ExpandDirection } from './diff-expand.util'

const ARROWS: Record<ExpandDirection, { icon: string; title: (n: number | null) => string }> = {
  up: { icon: '↑', title: () => `Show ${EXPAND_STEP} more lines above` },
  down: { icon: '↓', title: () => `Show ${EXPAND_STEP} more lines below` },
  all: { icon: '↕', title: (n) => `Show ${n === 1 ? 'the hidden line' : `all ${n} hidden lines`}` },
}

/** Which buttons a separator offers: one when little is hidden, else the directions that make sense where it sits. */
function directionsFor(gap: NonNullable<HunkHeader['gap']>): ExpandDirection[] {
  if (gap.hidden != null && gap.hidden <= EXPAND_STEP) return ['all']
  if (gap.first) return ['up']
  if (gap.last) return ['down']
  return ['down', 'up']
}

/** A hunk header, or the line marking hidden code between hunks, with buttons to show more of the file. */
export function HunkRow({ row, span, onExpand }: { row: HunkHeader; span: number; onExpand?: (gap: number, direction: ExpandDirection) => void }) {
  const gap = onExpand && row.gap
  return (
    <tr className="bg-hunk text-muted">
      <td colSpan={span} className="py-0 select-text">
        <div className="flex items-stretch">
          {gap && (
            <span className="flex shrink-0 flex-col border-r border-line select-none">
              {directionsFor(gap).map((d) => (
                <button key={d} className="flex-1 px-3 leading-[18px] hover:bg-accent/20 hover:text-fg" title={ARROWS[d].title(gap.hidden)} aria-label={ARROWS[d].title(gap.hidden)} onClick={() => onExpand(gap.index, d)}>
                  {ARROWS[d].icon}
                </button>
              ))}
            </span>
          )}
          <span className="min-w-0 flex-1 self-center px-3 py-0.5">{row.text || (gap ? (gap.hidden == null ? 'Rest of the file' : `${gap.hidden} more ${gap.hidden === 1 ? 'line' : 'lines'}`) : '')}</span>
        </div>
      </td>
    </tr>
  )
}
