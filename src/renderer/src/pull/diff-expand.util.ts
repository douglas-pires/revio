import type { DiffRow, HunkHeader, LineRow } from './diff.util'

/** Lines of the file the diff leaves out, before hunk `index` (or after the last hunk), by new-side line number. */
export interface Gap {
  index: number
  /** First hidden new-side line. */
  start: number
  /** Last hidden new-side line; null after the last hunk until the file's length is known. */
  end: number | null
  /** Old-side line = new-side line + offset; the lines are the same on both sides. */
  offset: number
}

/** How many lines of a gap are shown: from its top (after the previous hunk) and from its bottom (before the next). */
export interface GapShown {
  top: number
  bottom: number
}

export type ExpandDirection = 'up' | 'down' | 'all'

/** Lines one click on ↑ or ↓ reveals. */
export const EXPAND_STEP = 20

interface HunkSpan {
  header: HunkHeader
  body: LineRow[]
  /** The last line before the hunk on each side, and the last line in it. */
  oldBefore: number
  newBefore: number
  oldEnd: number
  newEnd: number
}

function hunksOf(rows: readonly DiffRow[]): HunkSpan[] {
  const hunks: { header: HunkHeader; body: LineRow[] }[] = []
  for (const row of rows) {
    if (row.kind === 'hunk') hunks.push({ header: row, body: [] })
    else hunks.at(-1)?.body.push(row)
  }
  return hunks.map(({ header, body }) => {
    const olds = body.flatMap((r) => (r.oldNo == null ? [] : [r.oldNo]))
    const news = body.flatMap((r) => (r.newNo == null ? [] : [r.newNo]))
    // A side with no lines in the hunk ("-10,0") names the line before it rather than the first line.
    const oldBefore = olds.length ? olds[0]! - 1 : header.oldStart
    const newBefore = news.length ? news[0]! - 1 : header.newStart
    return { header, body, oldBefore, newBefore, oldEnd: olds.at(-1) ?? oldBefore, newEnd: news.at(-1) ?? newBefore }
  })
}

/** Every gap the diff leaves, including empty ones, one per hunk plus one after the last. */
export function gapsOf(rows: readonly DiffRow[], totalLines: number | null): Gap[] {
  const hunks = hunksOf(rows)
  const gaps: Gap[] = hunks.map((h, i) => {
    const start = i === 0 ? 1 : hunks[i - 1]!.newEnd + 1
    return { index: i, start, end: h.newBefore, offset: h.oldBefore - h.newBefore }
  })
  const last = hunks.at(-1)
  if (last) gaps.push({ index: hunks.length, start: last.newEnd + 1, end: totalLines, offset: last.oldEnd - last.newEnd })
  return gaps
}

const lengthOf = (gap: Gap) => (gap.end == null ? null : Math.max(0, gap.end - gap.start + 1))

/** Lines of a gap still hidden; null when its length is unknown. */
export function hiddenIn(gap: Gap, shown: GapShown | undefined): number | null {
  const length = lengthOf(gap)
  return length == null ? null : Math.max(0, length - (shown?.top ?? 0) - (shown?.bottom ?? 0))
}

/** What one click reveals. "up" grows the lines shown above the next hunk, "down" those below the previous one. */
export function expandGap(shown: GapShown | undefined, direction: ExpandDirection, hidden: number | null): GapShown {
  const { top, bottom } = shown ?? { top: 0, bottom: 0 }
  const step = hidden == null ? EXPAND_STEP : Math.min(EXPAND_STEP, hidden)
  if (direction === 'all') return { top: top + (hidden ?? Number.MAX_SAFE_INTEGER), bottom }
  return direction === 'up' ? { top, bottom: bottom + step } : { top: top + step, bottom }
}

const contextRow = (lines: readonly string[], gap: Gap, newNo: number): LineRow => ({
  kind: 'ctx',
  text: lines[newNo - 1] ?? '',
  oldNo: newNo + gap.offset,
  newNo,
  expanded: true,
})

/**
 * The diff with the revealed lines of each gap filled in from the file at the PR head. A gap that still hides lines
 * keeps a separator row (the hunk header, or a blank one after the last hunk) that carries the gap for its buttons;
 * a gap opened all the way loses it. Without the file, only the separators are marked.
 */
export function expandRows(rows: readonly DiffRow[], lines: readonly string[] | null, shown: ReadonlyMap<number, GapShown>): DiffRow[] {
  const hunks = hunksOf(rows)
  if (!hunks.length) return [...rows]
  const gaps = gapsOf(rows, lines ? lines.length : null)
  const out: DiffRow[] = []
  gaps.forEach((gap, i) => {
    const hunk = hunks[i]
    const length = lengthOf(gap)
    const hidden = hiddenIn(gap, shown.get(i))
    const { top, bottom } = lines ? (shown.get(i) ?? { top: 0, bottom: 0 }) : { top: 0, bottom: 0 }
    const last = length == null ? Number.MAX_SAFE_INTEGER : gap.start + length - 1
    for (let n = gap.start; lines && n < gap.start + top && n <= last; n++) out.push(contextRow(lines, gap, n))
    if (hidden !== 0) {
      const separator: HunkHeader = hunk ? hunk.header : { kind: 'hunk', text: '', oldStart: gap.start + gap.offset, newStart: gap.start }
      out.push({ ...separator, gap: { index: i, hidden, first: i === 0, last: !hunk } })
    } else if (hunk && length === 0) out.push(hunk.header)
    if (lines && hunk) for (let n = Math.max(gap.start + top, last - bottom + 1); n <= last; n++) out.push(contextRow(lines, gap, n))
    if (hunk) out.push(...hunk.body)
  })
  return out
}
