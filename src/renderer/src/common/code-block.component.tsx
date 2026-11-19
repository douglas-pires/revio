import { useEffect, useState } from 'react'
import { type Tok, useHighlighter } from '../highlight/highlight.service.ts'
import { TokenText } from '../highlight/token-text.component.tsx'
import { CopyButton } from './copy-button.component.tsx'
import { numberLines } from './numbered-lines.util.ts'

/** Colored lines for `code`, kept only while they match it (answers stream in, so the code changes as it arrives). */
function useCodeTokens(language: string | undefined, code: string) {
  const highlighter = useHighlighter()
  const [result, setResult] = useState<{ code: string; lines: Tok[][] | null } | null>(null)
  useEffect(() => {
    if (!language) {
      return
    }
    let live = true
    highlighter
      .highlightCode(language, code)
      .then((lines) => live && setResult({ code, lines }))
      .catch(() => {
        // Unhighlighted code is still readable; nothing to report.
      })
    return () => {
      live = false
    }
  }, [highlighter, language, code])
  if (result?.code !== code) {
    return null
  }
  return result.lines
}

/** A fenced code block: highlighted when the language is known, selectable, with a copy button. */
export function CodeBlock(props: { code: string; language?: string | undefined; label?: string | undefined }) {
  const lines = useCodeTokens(props.language, props.code)
  return (
    <div className="not-prose group/code relative my-2 overflow-hidden rounded-md border border-line bg-panel-2">
      {Boolean(props.label) && (
        <div className="border-b border-line px-3 py-1 text-[11px] text-muted">{props.label}</div>
      )}
      <CopyButton
        text={props.code}
        title="Copy code"
        className="btn btn-ghost absolute top-1 right-1 bg-panel-2 py-0 text-[11px] opacity-0 transition group-hover/code:opacity-100 focus:opacity-100"
      >
        Copy
      </CopyButton>
      <pre className="selectable overflow-x-auto p-3 font-mono text-[12px] leading-[18px]">
        <code>
          {numberLines(props.code).map((line) => (
            <div key={line.number}>
              <TokenText tokens={lines?.[line.number - 1]} text={line.text} />
            </div>
          ))}
        </code>
      </pre>
    </div>
  )
}
