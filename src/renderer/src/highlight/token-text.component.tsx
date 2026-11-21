import { addOffsets } from '../common/numbered-lines.util.ts'
import type { Tok } from './highlight-tokens.util.ts'

/** A line of code: highlighted tokens when available, else the plain text. */
export function TokenText({ tokens, text }: { tokens?: readonly Tok[] | undefined; text: string }) {
  if (!tokens?.length) {
    return <>{text || ' '}</>
  }
  return (
    <>
      {addOffsets(tokens).map((token) => (
        // biome-ignore lint/style/noInlineStyles: each token carries its theme colors as CSS variables (see styles.css .tok).
        <span key={token.offset} className="tok" style={token.style}>
          {token.text}
        </span>
      ))}
    </>
  )
}
