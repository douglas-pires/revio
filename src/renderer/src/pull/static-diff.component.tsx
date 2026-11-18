import { useEffect, useState } from 'react'
import { cx } from '../common/format.util'
import { useHighlighter, type Tok } from '../highlight/highlight.service'
import type { DiffRow } from './diff.util'
import { rowBg } from './diff-cells.component'
import { TokenText } from '../highlight/token-text.component'

/** Read-only, highlighted diff rows (hunk headers included); `markLine` (new side) gets the focus marker. */
export function StaticDiff({ path, rows, sourceLength, markLine }: { path: string; rows: readonly DiffRow[]; sourceLength: number; markLine?: number }) {
  const tokens = useStaticTokens(path, rows, sourceLength)
  return (
    <table className="w-full border-collapse font-mono text-[11.5px] leading-[18px]">
      <tbody>
        {rows.map((row, i) => {
          if (row.kind === 'hunk')
            return (
              <tr key={i} className="bg-hunk text-muted">
                <td colSpan={3} className="px-2 py-0.5">
                  {row.text}
                </td>
              </tr>
            )
          const marked = markLine != null && row.kind !== 'del' && row.newNo === markLine
          return (
            <tr key={i} className={cx(rowBg(row.kind), marked && 'shadow-[inset_3px_0_0_var(--color-focus)] !bg-focus/15')}>
              <td className="w-[1%] px-2 text-right whitespace-nowrap text-muted/70 select-none">{row.kind === 'del' ? row.oldNo : row.newNo}</td>
              <td className="w-4 text-muted select-none">{row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ''}</td>
              <td className="pr-3 break-all whitespace-pre-wrap">
                <TokenText tokens={tokens?.get(i)} text={row.text} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function useStaticTokens(path: string, rows: readonly DiffRow[], sourceLength: number) {
  const highlighter = useHighlighter()
  const [tokens, setTokens] = useState<Map<number, Tok[]> | null>(null)
  useEffect(() => {
    if (!rows.length) return
    let live = true
    highlighter
      .highlightRows(path, rows, sourceLength)
      .then((t) => live && setTokens(t))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [highlighter, path, rows, sourceLength])
  return tokens
}
