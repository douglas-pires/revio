import { useEffect, useMemo, useState } from 'react'
import { cx } from '../common/format.util'
import { useHighlighter, type Tok } from '../highlight/highlight.service'
import { parsePatch, sliceAroundLine } from './diff.util'
import { rowBg, TokenText } from './diff-cells.component'

/** A few highlighted diff lines around `line`, that line marked. Renders nothing when the line is not in the diff. */
export function CodeSnippet({ path, patch, line, onOpen }: { path: string; patch: string; line: number; onOpen: () => void }) {
  const rows = useMemo(() => sliceAroundLine(parsePatch(patch), line), [patch, line])
  const tokens = useSnippetTokens(path, rows, patch.length)
  if (!rows.length) return null
  return (
    <button
      className="mt-2 block w-full overflow-hidden rounded-md border border-line bg-panel text-left hover:border-accent/60"
      title={`Open ${path} at line ${line}`}
      onClick={onOpen}
    >
      <table className="w-full border-collapse font-mono text-[11.5px] leading-[18px]">
        <tbody>
          {rows.map((row, i) => {
            const target = row.kind !== 'del' && row.newNo === line
            return (
              <tr key={i} className={cx(rowBg(row.kind), target && 'shadow-[inset_3px_0_0_var(--color-focus)] !bg-focus/15')}>
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
    </button>
  )
}

function useSnippetTokens(path: string, rows: Parameters<typeof sliceAroundLine>[0], patchLength: number) {
  const highlighter = useHighlighter()
  const [tokens, setTokens] = useState<Map<number, Tok[]> | null>(null)
  useEffect(() => {
    if (!rows.length) return
    let live = true
    highlighter
      .highlightRows(path, rows, patchLength)
      .then((t) => live && setTokens(t))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [highlighter, path, rows, patchLength])
  return tokens
}
