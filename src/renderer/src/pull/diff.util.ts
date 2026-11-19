import type { DiffSide } from '@shared/pull.types.ts'

const HUNK = /^@@ -(?<oldStart>\d+)(?:,\d+)? \+(?<newStart>\d+)(?:,\d+)? @@(?:.*)$/u

const RANGE = /^(?<from>\d+)(?:\s*-\s*(?<to>\d+))?$/u

/** Rows shown on each side of a line by `sliceAroundLine` unless asked otherwise. */
const DEFAULT_RADIUS = 3

/** The marker a diff line starts with, by kind. */
const SIGNS: Record<LineRow['kind'], string> = { add: '+', del: '-', ctx: ' ' }

const inRange = (n: number | null, start: number, end: number) => n !== null && n >= start && n <= end

/** A row's line number on one side; null where the row has no line there (added rows on the old side, and so on). */
function lineOnSide(row: LineRow, side: DiffSide) {
  if (side === 'LEFT') {
    return row.oldNo
  }
  return row.newNo
}

function kindOfMarker(line: string): LineRow['kind'] {
  if (line.startsWith('+')) {
    return 'add'
  }
  if (line.startsWith('-')) {
    return 'del'
  }
  return 'ctx'
}

/** Line numbers that advance as a patch is read: each line takes the current number on its sides. */
class LineCounter {
  old = 0
  new = 0

  /** The row for one patch line, numbering it and moving past it. */
  rowFor(kind: LineRow['kind'], text: string): LineRow {
    const row: LineRow = { kind, text, oldNo: null, newNo: null }
    if (kind !== 'add') {
      row.oldNo = this.old
      this.old += 1
    }
    if (kind !== 'del') {
      row.newNo = this.new
      this.new += 1
    }
    return row
  }
}

function splitRowOf(row: HunkHeader | LineRow, i: number): SplitRow {
  if (row.kind === 'hunk') {
    return { kind: 'hunk', idx: i }
  }
  return { kind: 'pair', left: i, right: i }
}

/** A selection of only removed lines is on the old side; anything else is on the new side. */
function sideOfSelection(rows: readonly LineRow[]): DiffSide {
  if (rows.length > 0 && rows.every((r) => r.kind === 'del')) {
    return 'LEFT'
  }
  return 'RIGHT'
}

/** Hidden lines a separator row stands for, so it can offer to show them. */
export interface GapMarker {
  index: number
  /** Null when the file's length is not known yet (after the last hunk). */
  hidden: number | null
  /** Before the first hunk: only "up" makes sense. */
  first: boolean
  /** After the last hunk: only "down" makes sense. */
  last: boolean
}

export interface HunkHeader {
  kind: 'hunk'
  text: string
  oldStart: number
  newStart: number
  gap?: GapMarker
}

/** A line of the diff. `expanded` lines were filled in from the file; GitHub takes no comments on them. */
export interface LineRow {
  kind: 'ctx' | 'add' | 'del'
  text: string
  oldNo: number | null
  newNo: number | null
  expanded?: true
}

export type DiffRow = HunkHeader | LineRow

export type SplitRow = { kind: 'hunk'; idx: number } | { kind: 'pair'; left: number | null; right: number | null }

/** The rows of a unified diff; none for an empty patch (GitHub sends none for binary or very large files). */
export function parsePatch(patch: string): DiffRow[] {
  if (!patch) {
    return []
  }
  const rows: DiffRow[] = []
  const counter = new LineCounter()
  // "\ No newline at end of file" lines are not part of the code.
  for (const raw of patch.split('\n').filter((line) => !line.startsWith('\\'))) {
    const hunk = HUNK.exec(raw)?.groups
    if (hunk) {
      counter.old = Number(hunk.oldStart)
      counter.new = Number(hunk.newStart)
      rows.push({ kind: 'hunk', text: raw, oldStart: counter.old, newStart: counter.new })
    } else {
      rows.push(counter.rowFor(kindOfMarker(raw), raw.slice(1)))
    }
  }
  return rows
}

/** The (side, line) a review comment on this row attaches to, as GitHub expects. */
export function anchorOf(row: DiffRow): { side: DiffSide; line: number } | null {
  if (row.kind === 'hunk') {
    return null
  }
  if (row.kind === 'del' && row.oldNo !== null) {
    return { side: 'LEFT', line: row.oldNo }
  }
  if (row.newNo !== null) {
    return { side: 'RIGHT', line: row.newNo }
  }
  return null
}

export const anchorKey = (side: DiffSide, line: number) => `${side}:${line}`

/** Parses "42-80", "42", "" into an inclusive range on the new side. */
export function parseRange(lines: string): [number, number] | null {
  const groups = RANGE.exec(lines.trim())?.groups
  if (!groups) {
    return null
  }
  const a = Number(groups.from)
  const b = Number(groups.to ?? groups.from)
  return [Math.min(a, b), Math.max(a, b)]
}

/** Thread/draft lookup keys a row owns. Context lines can carry comments on either side. */
export function keysOf(row: DiffRow, only?: DiffSide): string[] {
  if (row.kind === 'hunk') {
    return []
  }
  const keys: string[] = []
  if (row.newNo !== null && only !== 'LEFT') {
    keys.push(anchorKey('RIGHT', row.newNo))
  }
  if (row.oldNo !== null && only !== 'RIGHT') {
    keys.push(anchorKey('LEFT', row.oldNo))
  }
  return keys
}

/** Where a new comment on this row (or on one half of it in split view) attaches. */
export function anchorFor(row: DiffRow, half?: DiffSide): { side: DiffSide; line: number } | null {
  if (row.kind === 'hunk' || row.expanded) {
    return null
  }
  if (!half) {
    return anchorOf(row)
  }
  const line = lineOnSide(row, half)
  if (line === null) {
    return null
  }
  return { side: half, line }
}

/** Pairs removed and added runs side by side; context lines sit on both sides. */
export function toSplit(rows: DiffRow[]): SplitRow[] {
  const out: SplitRow[] = []
  let dels: number[] = []
  let adds: number[] = []
  const flush = () => {
    for (let k = 0; k < Math.max(dels.length, adds.length); k += 1) {
      out.push({ kind: 'pair', left: dels[k] ?? null, right: adds[k] ?? null })
    }
    dels = []
    adds = []
  }
  for (const [i, r] of rows.entries()) {
    if (r.kind === 'del' && adds.length > 0) {
      flush()
    }
    if (r.kind === 'del') {
      dels.push(i)
    } else if (r.kind === 'add') {
      adds.push(i)
    } else {
      flush()
      out.push(splitRowOf(r, i))
    }
  }
  flush()
  return out
}

/** Up to `radius` diff rows on each side of a new-side line, without leaving its hunk. Empty when the line is not in the diff. */
export function sliceAroundLine(rows: readonly DiffRow[], line: number, radius = DEFAULT_RADIUS): LineRow[] {
  const at = rows.findIndex((r) => r.kind !== 'hunk' && r.newNo === line)
  if (at < 0) {
    return []
  }
  const inHunk = (i: number) => i >= 0 && i < rows.length && rows[i]?.kind !== 'hunk'
  let start = at
  let end = at
  while (at - start < radius && inHunk(start - 1)) {
    start -= 1
  }
  while (end - at < radius && inHunk(end + 1)) {
    end += 1
  }
  return rows.slice(start, end + 1) as LineRow[]
}

/** Diff rows covering (side, start..end) with +/- markers, as shown to Claude. Old-side snippets leave out added rows. */
export function diffSnippet(rows: readonly DiffRow[], side: DiffSide, start: number, end: number): string {
  const hits = [...rows.entries()]
    .filter(([, r]) => r.kind !== 'hunk' && inRange(lineOnSide(r, side), start, end))
    .map(([i]) => i)
  const [first] = hits
  const last = hits.at(-1)
  if (first === undefined || last === undefined) {
    return ''
  }
  return rows
    .slice(first, last + 1)
    .filter((r): r is LineRow => r.kind !== 'hunk' && !(side === 'LEFT' && r.kind === 'add'))
    .map((r) => `${SIGNS[r.kind]}${r.text}`)
    .join('\n')
}

/**
 * Rows back from a `diffSnippet` (each line marked ' ', '+' or '-') that starts at `startLine` on `side`, so the
 * snippet can be shown as a highlighted diff. Only that side's lines are numbered.
 */
export function snippetRows(snippet: string, side: DiffSide, startLine: number): LineRow[] {
  let next = startLine
  return snippet.split('\n').map((line) => {
    const row: LineRow = { kind: kindOfMarker(line), text: line.slice(1), oldNo: null, newNo: null }
    const otherKind = ({ LEFT: 'add', RIGHT: 'del' } as const)[side]
    if (row.kind === otherKind) {
      return row
    }
    if (side === 'LEFT') {
      row.oldNo = next
    } else {
      row.newNo = next
    }
    next += 1
    return row
  })
}

/** The new-side text of lines start..end, used to prefill a suggestion. */
export function newSideText(rows: readonly DiffRow[], start: number, end: number): string {
  return rows
    .filter((r): r is LineRow => r.kind !== 'hunk' && inRange(r.newNo, start, end))
    .map((r) => r.text)
    .join('\n')
}

/**
 * The line range a text selection over rows i0..i1 covers. `half` is the split-view side the selection
 * started in; in unified view a selection of only deleted rows is on the old side.
 */
export function lineRangeOfRows(
  rows: readonly DiffRow[],
  i0: number,
  i1: number,
  half?: DiffSide,
): { side: DiffSide; start: number; end: number } | null {
  const slice = rows.slice(Math.min(i0, i1), Math.max(i0, i1) + 1).filter((r): r is LineRow => r.kind !== 'hunk')
  const side = half ?? sideOfSelection(slice)
  const nums = slice.map((r) => lineOnSide(r, side)).filter((n): n is number => n !== null)
  if (nums.length === 0) {
    return null
  }
  return { side, start: Math.min(...nums), end: Math.max(...nums) }
}
