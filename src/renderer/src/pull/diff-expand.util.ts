import { isPresent } from '@shared/presence.util.ts'
import type { DiffRow, HunkHeader, LineRow } from './diff.util.ts'

interface HunkSpan {
  header: HunkHeader
  body: LineRow[]
  /** The last line before the hunk on each side, and the last line in it. */
  oldBefore: number
  newBefore: number
  oldEnd: number
  newEnd: number
}

function findHunks(rows: readonly DiffRow[]): HunkSpan[] {
  const hunks: { header: HunkHeader; body: LineRow[] }[] = []
  for (const row of rows) {
    if (row.kind === 'hunk') {
      hunks.push({ header: row, body: [] })
    } else {
      hunks.at(-1)?.body.push(row)
    }
  }
  return hunks.map(({ header, body }) => {
    const olds = body.map((row) => row.oldNo).filter(isPresent)
    const news = body.map((row) => row.newNo).filter(isPresent)
    const oldBefore = findLineBefore(olds, header.oldStart)
    const newBefore = findLineBefore(news, header.newStart)
    return { header, body, oldBefore, newBefore, oldEnd: olds.at(-1) ?? oldBefore, newEnd: news.at(-1) ?? newBefore }
  })
}

/** The last line before a hunk on one side. A side with no lines in it ("-10,0") names that line in its header. */
function findLineBefore(lines: readonly number[], headerStart: number) {
  const [first] = lines
  if (first === undefined) {
    return headerStart
  }
  return first - 1
}

function measureGap(gap: Gap) {
  if (gap.end === null) {
    return null
  }
  return Math.max(0, gap.end - gap.start + 1)
}

const buildContextRow = (lines: readonly string[], gap: Gap, newNo: number): LineRow => ({
  kind: 'ctx',
  text: lines[newNo - 1] ?? '',
  oldNo: newNo + gap.offset,
  newNo,
  expanded: true,
})

/** Rows for new-side lines first..last of a gap, read from the file. */
function buildContextRows(lines: readonly string[], gap: Gap, first: number, last: number): LineRow[] {
  const rows: LineRow[] = []
  for (let lineNumber = first; lineNumber <= last; lineNumber += 1) {
    rows.push(buildContextRow(lines, gap, lineNumber))
  }
  return rows
}

/** The separator for a gap that still hides lines: the next hunk's header, or a blank one after the last hunk. */
function buildSeparator(gap: Gap, hunk: HunkSpan | undefined, hidden: number | null): HunkHeader {
  const header: HunkHeader = hunk?.header ?? {
    kind: 'hunk',
    text: '',
    oldStart: gap.start + gap.offset,
    newStart: gap.start,
  }
  return { ...header, gap: { index: gap.index, hidden, first: gap.index === 0, last: !hunk } }
}

/** A gap's rows: lines shown from its top, its separator (while lines stay hidden), lines from its bottom, the hunk. */
function buildGapRows(
  gap: Gap,
  hunk: HunkSpan | undefined,
  lines: readonly string[] | null,
  shown: GapShown | undefined,
) {
  const length = measureGap(gap)
  const hidden = countHiddenLines(gap, shown)
  let last = Number.MAX_SAFE_INTEGER
  if (length !== null) {
    last = gap.start + length - 1
  }
  const output: DiffRow[] = []
  if (lines) {
    const { top, bottom } = shown ?? { top: 0, bottom: 0 }
    output.push(...buildContextRows(lines, gap, gap.start, Math.min(gap.start + top - 1, last)))
    if (hidden !== 0) {
      output.push(buildSeparator(gap, hunk, hidden))
    }
    if (hunk) {
      output.push(...buildContextRows(lines, gap, Math.max(gap.start + top, last - bottom + 1), last))
    }
  } else if (hidden !== 0) {
    output.push(buildSeparator(gap, hunk, hidden))
  }
  if (hidden === 0 && hunk && length === 0) {
    output.push(hunk.header)
  }
  if (hunk) {
    output.push(...hunk.body)
  }
  return output
}

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

/** Every gap the diff leaves, including empty ones, one per hunk plus one after the last. */
export function findGaps(rows: readonly DiffRow[], totalLines: number | null): Gap[] {
  const hunks = findHunks(rows)
  const gaps: Gap[] = hunks.map((hunk, index) => {
    // The first gap starts at line 1; the others right after the previous hunk.
    const start = (hunks[index - 1]?.newEnd ?? 0) + 1
    return { index, start, end: hunk.newBefore, offset: hunk.oldBefore - hunk.newBefore }
  })
  const last = hunks.at(-1)
  if (last) {
    gaps.push({ index: hunks.length, start: last.newEnd + 1, end: totalLines, offset: last.oldEnd - last.newEnd })
  }
  return gaps
}

/** Lines of a gap still hidden; null when its length is unknown. */
export function countHiddenLines(gap: Gap, shown: GapShown | undefined): number | null {
  const length = measureGap(gap)
  if (length === null) {
    return null
  }
  return Math.max(0, length - (shown?.top ?? 0) - (shown?.bottom ?? 0))
}

/** What one click reveals. "up" grows the lines shown above the next hunk, "down" those below the previous one. */
export function expandGap(shown: GapShown | undefined, direction: ExpandDirection, hidden: number | null): GapShown {
  const { top, bottom } = shown ?? { top: 0, bottom: 0 }
  const step = Math.min(EXPAND_STEP, hidden ?? EXPAND_STEP)
  if (direction === 'all') {
    return { top: top + (hidden ?? Number.MAX_SAFE_INTEGER), bottom }
  }
  if (direction === 'up') {
    return { top, bottom: bottom + step }
  }
  return { top: top + step, bottom }
}

/**
 * The diff with the revealed lines of each gap filled in from the file at the PR head. A gap that still hides lines
 * keeps a separator row (the hunk header, or a blank one after the last hunk) that carries the gap for its buttons;
 * a gap opened all the way loses it. Without the file, only the separators are marked.
 */
export function expandRows(
  rows: readonly DiffRow[],
  lines: readonly string[] | null,
  shown: ReadonlyMap<number, GapShown>,
): DiffRow[] {
  const hunks = findHunks(rows)
  if (hunks.length === 0) {
    return [...rows]
  }
  return findGaps(rows, lines?.length ?? null).flatMap((gap) =>
    buildGapRows(gap, hunks[gap.index], lines, shown.get(gap.index)),
  )
}
