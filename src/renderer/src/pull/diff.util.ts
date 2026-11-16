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
