import type { FloatingAsk } from './use-text-selection-ask.hook.ts'

/** Gap between the end of the selection and the button. */
const OFFSET_X_PX = 8
const OFFSET_Y_PX = 10

function describeLines(at: FloatingAsk) {
  if (at.start === at.end) {
    return `L${at.end}`
  }
  return `L${at.start}–${at.end}`
}

/** Floats next to selected code text. Acts on mouse-down, before the press clears the text selection. */
export function AskClaudeButton({ at, onAsk }: { at: FloatingAsk; onAsk: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-primary fixed z-50 shadow-lg"
      // biome-ignore lint/style/noInlineStyles: the button sits where the text selection ended.
      style={{ left: at.x + OFFSET_X_PX, top: at.y + OFFSET_Y_PX }}
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onAsk()
      }}
    >
      ✦ Ask Claude · {describeLines(at)}
    </button>
  )
}
