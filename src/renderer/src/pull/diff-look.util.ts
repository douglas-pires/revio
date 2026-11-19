import type { DiffRow } from './diff.util.ts'

const ROW_BACKGROUNDS: Record<DiffRow['kind'], string> = { add: 'bg-add-bg', del: 'bg-del-bg', ctx: '', hunk: '' }

/** The +/− shown before a line, by kind. */
export const DIFF_SIGNS: Record<DiffRow['kind'], string> = { add: '+', del: '−', ctx: '', hunk: '' }

/** The background class of a diff row: green for added lines, red for removed ones. */
export const rowBg = (kind: DiffRow['kind']) => ROW_BACKGROUNDS[kind]

/**
 * A stable React key for a row of one file's diff: its line numbers, or a hunk's start lines. Expanding context
 * inserts rows, so array indices would shift and remount every row after the insertion.
 */
export function rowKey(row: DiffRow) {
  if (row.kind === 'hunk') {
    return `@${row.oldStart},${row.newStart}`
  }
  return `${row.oldNo ?? '-'}:${row.newNo ?? '-'}`
}
