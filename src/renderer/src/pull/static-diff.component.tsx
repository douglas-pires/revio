import { useEffect, useState } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { type Tok, useHighlighter } from '../highlight/highlight.service.ts'
import { TokenText } from '../highlight/token-text.component.tsx'
import type { DiffRow } from './diff.util.ts'
import { buildRowKey, DIFF_SIGNS, pickRowBackground } from './diff-look.util.ts'

function useStaticTokens(path: string, rows: readonly DiffRow[], sourceLength: number) {
  const highlighter = useHighlighter()
  const [tokens, setTokens] = useState<Map<number, Tok[]> | null>(null)
  useEffect(() => {
    if (rows.length === 0) {
      return
    }
    let live = true
    highlighter
      .highlightRows(path, rows, sourceLength)
      .then((loadedTokens) => live && setTokens(loadedTokens))
      .catch(() => {
        // Unhighlighted rows are still readable; nothing to report.
      })
    return () => {
      live = false
    }
  }, [highlighter, path, rows, sourceLength])
  return tokens
}

/** Read-only, highlighted diff rows (hunk headers included); `markLine` (new side) gets the focus marker. */
export function StaticDiff({
  path,
  rows,
  sourceLength,
  markLine,
}: {
  path: string
  rows: readonly DiffRow[]
  sourceLength: number
  markLine?: number
}) {
  const tokens = useStaticTokens(path, rows, sourceLength)
  return (
    <table className="w-full border-collapse font-mono text-[11.5px] leading-[18px]">
      <tbody>
        {rows.map((row, index) => {
          if (row.kind === 'hunk') {
            return (
              <tr key={buildRowKey(row)} className="bg-hunk text-muted">
                <td colSpan={3} className="px-2 py-0.5">
                  {row.text}
                </td>
              </tr>
            )
          }
          const marked = row.kind !== 'del' && row.newNo === markLine
          return (
            <tr
              key={buildRowKey(row)}
              className={joinClassNames(
                pickRowBackground(row.kind),
                marked && 'shadow-[inset_3px_0_0_var(--color-focus)] !bg-focus/15',
              )}
            >
              <td className="w-[1%] px-2 text-right whitespace-nowrap text-muted/70 select-none">
                {row.newNo ?? row.oldNo}
              </td>
              <td className="w-4 text-muted select-none">{DIFF_SIGNS[row.kind]}</td>
              <td className="pr-3 break-all whitespace-pre-wrap">
                <TokenText tokens={tokens?.get(index)} text={row.text} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
