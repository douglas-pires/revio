import type { Tok } from './highlight-tokens.util'

/** A line of code: highlighted tokens when available, else the plain text. */
export function TokenText({ tokens, text }: { tokens?: readonly Tok[]; text: string }) {
  if (!tokens?.length) return <>{text || ' '}</>
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className="tok" style={t.style}>
          {t.text}
        </span>
      ))}
    </>
  )
}
