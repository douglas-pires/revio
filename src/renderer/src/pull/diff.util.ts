import type { DiffSide } from '@shared/pull.types.ts'

const HUNK = /^@@ -(?<oldStart>\d+)(?:,\d+)? \+(?<newStart>\d+)(?:,\d+)? @@(?:.*)$/u

const RANGE = /^(?<from>\d+)(?:\s*-\s*(?<to>\d+))?$/u

/** Rows shown on each side of a line by `sliceAroundLine` unless asked otherwise. */
const DEFAULT_RADIUS = 3

/** The marker a diff line starts with, by kind. */
const SIGNS: Record<LineRow['kind'], string> = { add: '+', del: '-', ctx: ' ' }

const isInRange = (lineNumber: number | null, start: number, end: number) =>
  lineNumber !== null && lineNumber >= start && lineNumber <= end

/** A row's line number on one side; null where the row has no line there (added rows on the old side, and so on). */
function readLineOnSide(row: LineRow, side: DiffSide) {
  if (side === 'LEFT') {
    return row.oldNo
  }
  return row.newNo
}

function readLineKind(line: string): LineRow['kind'] {
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

function splitRowOf(row: HunkHeader | LineRow, position: number): SplitRow {
  if (row.kind === 'hunk') {
    return { kind: 'hunk', idx: position }
  }
  return { kind: 'pair', left: position, right: position }
}

/** A selection of only removed lines is on the old side; anything else is on the new side. */
function findSelectionSide(rows: readonly LineRow[]): DiffSide {
  if (rows.length > 0 && rows.every((row) => row.kind === 'del')) {
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
      rows.push(counter.rowFor(readLineKind(raw), raw.slice(1)))
    }
  }
  return rows
}

/** The (side, line) a review comment on this row attaches to, as GitHub expects. */
export function readRowAnchor(row: DiffRow): { side: DiffSide; line: number } | null {
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

export const buildAnchorKey = (side: DiffSide, line: number) => `${side}:${line}`

/** Parses "42-80", "42", "" into an inclusive range on the new side. */
export function parseRange(lines: string): [number, number] | null {
  const groups = RANGE.exec(lines.trim())?.groups
  if (!groups) {
    return null
  }
  const firstLine = Number(groups.from)
  const lastLine = Number(groups.to ?? groups.from)
  return [Math.min(firstLine, lastLine), Math.max(firstLine, lastLine)]
}

/** Thread/draft lookup keys a row owns. Context lines can carry comments on either side. */
export function listRowKeys(row: DiffRow, only?: DiffSide): string[] {
  if (row.kind === 'hunk') {
    return []
  }
  const keys: string[] = []
  if (row.newNo !== null && only !== 'LEFT') {
    keys.push(buildAnchorKey('RIGHT', row.newNo))
  }
  if (row.oldNo !== null && only !== 'RIGHT') {
    keys.push(buildAnchorKey('LEFT', row.oldNo))
  }
  return keys
}

/** Where a new comment on this row (or on one half of it in split view) attaches. */
export function findRowAnchor(row: DiffRow, half?: DiffSide): { side: DiffSide; line: number } | null {
  if (row.kind === 'hunk' || row.expanded) {
    return null
  }
  if (!half) {
    return readRowAnchor(row)
  }
  const line = readLineOnSide(row, half)
  if (line === null) {
    return null
  }
  return { side: half, line }
}

/** Pairs removed and added runs side by side; context lines sit on both sides. */
export function toSplit(rows: DiffRow[]): SplitRow[] {
  const output: SplitRow[] = []
  let dels: number[] = []
  let adds: number[] = []
  const flush = () => {
    for (let pairIndex = 0; pairIndex < Math.max(dels.length, adds.length); pairIndex += 1) {
      output.push({ kind: 'pair', left: dels[pairIndex] ?? null, right: adds[pairIndex] ?? null })
    }
    dels = []
    adds = []
  }
  for (const [position, row] of rows.entries()) {
    if (row.kind === 'del' && adds.length > 0) {
      flush()
    }
    if (row.kind === 'del') {
      dels.push(position)
    } else if (row.kind === 'add') {
      adds.push(position)
    } else {
      flush()
      output.push(splitRowOf(row, position))
    }
  }
  flush()
  return output
}

/** Up to `radius` diff rows on each side of a new-side line, without leaving its hunk. Empty when the line is not in the diff. */
export function sliceAroundLine(rows: readonly DiffRow[], line: number, radius = DEFAULT_RADIUS): LineRow[] {
  const at = rows.findIndex((row) => row.kind !== 'hunk' && row.newNo === line)
  if (at < 0) {
    return []
  }
  const isInHunk = (position: number) => position >= 0 && position < rows.length && rows[position]?.kind !== 'hunk'
  let start = at
  let end = at
  while (at - start < radius && isInHunk(start - 1)) {
    start -= 1
  }
  while (end - at < radius && isInHunk(end + 1)) {
    end += 1
  }
  return rows.slice(start, end + 1) as LineRow[]
}

/** Diff rows covering (side, start..end) with +/- markers, as shown to Claude. Old-side snippets leave out added rows. */
export function extractDiffSnippet(rows: readonly DiffRow[], side: DiffSide, start: number, end: number): string {
  const hits = [...rows.entries()]
    .filter(([, row]) => row.kind !== 'hunk' && isInRange(readLineOnSide(row, side), start, end))
    .map(([position]) => position)
  const [first] = hits
  const last = hits.at(-1)
  if (first === undefined || last === undefined) {
    return ''
  }
  return rows
    .slice(first, last + 1)
    .filter((row): row is LineRow => row.kind !== 'hunk' && !(side === 'LEFT' && row.kind === 'add'))
    .map((row) => `${SIGNS[row.kind]}${row.text}`)
    .join('\n')
}

/**
 * Rows back from a `diffSnippet` (each line marked ' ', '+' or '-') that starts at `startLine` on `side`, so the
 * snippet can be shown as a highlighted diff. Only that side's lines are numbered.
 */
export function parseSnippetRows(snippet: string, side: DiffSide, startLine: number): LineRow[] {
  let next = startLine
  return snippet.split('\n').map((line) => {
    const row: LineRow = { kind: readLineKind(line), text: line.slice(1), oldNo: null, newNo: null }
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
export function extractNewSideText(rows: readonly DiffRow[], start: number, end: number): string {
  return rows
    .filter((row): row is LineRow => row.kind !== 'hunk' && isInRange(row.newNo, start, end))
    .map((row) => row.text)
    .join('\n')
}

/**
 * The line range a text selection over rows i0..i1 covers. `half` is the split-view side the selection
 * started in; in unified view a selection of only deleted rows is on the old side.
 */
export function computeLineRange(
  rows: readonly DiffRow[],
  fromIndex: number,
  toIndex: number,
  half?: DiffSide,
): { side: DiffSide; start: number; end: number } | null {
  const slice = rows
    .slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1)
    .filter((row): row is LineRow => row.kind !== 'hunk')
  const side = half ?? findSelectionSide(slice)
  const nums = slice
    .map((row) => readLineOnSide(row, side))
    .filter((lineNumber): lineNumber is number => lineNumber !== null)
  if (nums.length === 0) {
    return null
  }
  return { side, start: Math.min(...nums), end: Math.max(...nums) }
}
