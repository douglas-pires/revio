import type { DiffSide } from '@shared/pull.types'

export type DiffRow =
  | { kind: 'hunk'; text: string; oldStart: number; newStart: number }
  | { kind: 'ctx' | 'add' | 'del'; text: string; oldNo: number | null; newNo: number | null }

export type LineRow = Exclude<DiffRow, { kind: 'hunk' }>

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/

export function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = []
  let oldNo = 0
  let newNo = 0
  for (const raw of patch.split('\n')) {
    const m = HUNK.exec(raw)
    if (m) {
      oldNo = Number(m[1])
      newNo = Number(m[2])
      rows.push({ kind: 'hunk', text: raw, oldStart: oldNo, newStart: newNo })
      continue
    }
    if (raw.startsWith('\\')) continue // "\ No newline at end of file"
    const c = raw[0]
    const text = raw.slice(1)
    if (c === '+') rows.push({ kind: 'add', text, oldNo: null, newNo: newNo++ })
    else if (c === '-') rows.push({ kind: 'del', text, oldNo: oldNo++, newNo: null })
    else rows.push({ kind: 'ctx', text, oldNo: oldNo++, newNo: newNo++ })
  }
  return rows
}

/** The (side, line) a review comment on this row attaches to, as GitHub expects. */
export function anchorOf(row: DiffRow): { side: DiffSide; line: number } | null {
  if (row.kind === 'hunk') return null
  if (row.kind === 'del') return { side: 'LEFT', line: row.oldNo! }
  return { side: 'RIGHT', line: row.newNo! }
}

export const anchorKey = (side: DiffSide, line: number) => `${side}:${line}`

/** Parses "42-80", "42", "" into an inclusive range on the new side. */
export function parseRange(lines: string): [number, number] | null {
  const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(lines.trim())
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] ? Number(m[2]) : a
  return [Math.min(a, b), Math.max(a, b)]
}

/** Thread/draft lookup keys a row owns. Context lines can carry comments on either side. */
export function keysOf(row: DiffRow, only?: DiffSide): string[] {
  if (row.kind === 'hunk') return []
  const keys: string[] = []
  if (row.newNo != null && only !== 'LEFT') keys.push(anchorKey('RIGHT', row.newNo))
  if (row.oldNo != null && only !== 'RIGHT') keys.push(anchorKey('LEFT', row.oldNo))
  return keys
}

/** Where a new comment on this row (or on one half of it in split view) attaches. */
export function anchorFor(row: DiffRow, half?: DiffSide): { side: DiffSide; line: number } | null {
  if (row.kind === 'hunk') return null
  if (half === 'LEFT') return row.oldNo != null ? { side: 'LEFT', line: row.oldNo } : null
  if (half === 'RIGHT') return row.newNo != null ? { side: 'RIGHT', line: row.newNo } : null
  return anchorOf(row)
}

export type SplitRow = { kind: 'hunk'; idx: number } | { kind: 'pair'; left: number | null; right: number | null }

/** Pairs removed and added runs side by side; context lines sit on both sides. */
export function toSplit(rows: DiffRow[]): SplitRow[] {
  const out: SplitRow[] = []
  let dels: number[] = []
  let adds: number[] = []
  const flush = () => {
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) out.push({ kind: 'pair', left: dels[k] ?? null, right: adds[k] ?? null })
    dels = []
    adds = []
  }
  rows.forEach((r, i) => {
    if (r.kind === 'del') {
      if (adds.length) flush()
      dels.push(i)
    } else if (r.kind === 'add') adds.push(i)
    else {
      flush()
      out.push(r.kind === 'hunk' ? { kind: 'hunk', idx: i } : { kind: 'pair', left: i, right: i })
    }
  })
  flush()
  return out
}

/** Up to `radius` diff rows on each side of a new-side line, without leaving its hunk. Empty when the line is not in the diff. */
export function sliceAroundLine(rows: readonly DiffRow[], line: number, radius = 3): LineRow[] {
  const at = rows.findIndex((r) => r.kind !== 'hunk' && r.newNo === line)
  if (at < 0) return []
  const inHunk = (i: number) => i >= 0 && i < rows.length && rows[i]!.kind !== 'hunk'
  let start = at
  let end = at
  while (at - start < radius && inHunk(start - 1)) start--
  while (end - at < radius && inHunk(end + 1)) end++
  return rows.slice(start, end + 1) as LineRow[]
}

const inRange = (n: number | null, start: number, end: number) => n != null && n >= start && n <= end

/** Diff rows covering (side, start..end) with +/- markers, as shown to Claude. Old-side snippets leave out added rows. */
export function diffSnippet(rows: readonly DiffRow[], side: DiffSide, start: number, end: number): string {
  const hits = rows.flatMap((r, i) => (r.kind !== 'hunk' && inRange(side === 'LEFT' ? r.oldNo : r.newNo, start, end) ? [i] : []))
  if (!hits.length) return ''
  return rows
    .slice(hits[0], hits.at(-1)! + 1)
    .filter((r): r is LineRow => r.kind !== 'hunk' && !(side === 'LEFT' && r.kind === 'add'))
    .map((r) => `${r.kind === 'add' ? '+' : r.kind === 'del' ? '-' : ' '}${r.text}`)
    .join('\n')
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
export function lineRangeOfRows(rows: readonly DiffRow[], i0: number, i1: number, half?: DiffSide): { side: DiffSide; start: number; end: number } | null {
  const slice = rows.slice(Math.min(i0, i1), Math.max(i0, i1) + 1).filter((r): r is LineRow => r.kind !== 'hunk')
  const side: DiffSide = half ?? (slice.length && slice.every((r) => r.kind === 'del') ? 'LEFT' : 'RIGHT')
  const nums = slice.flatMap((r) => {
    const n = side === 'LEFT' ? (r.kind === 'add' ? null : r.oldNo) : r.kind === 'del' ? null : r.newNo
    return n == null ? [] : [n]
  })
  if (!nums.length) return null
  return { side, start: Math.min(...nums), end: Math.max(...nums) }
}
