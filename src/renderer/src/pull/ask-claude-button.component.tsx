import type { FloatingAsk } from './use-text-selection-ask.hook'

/** Floats next to selected code text. Acts on mouse-down, before the press clears the text selection. */
export function AskClaudeButton({ at, onAsk }: { at: FloatingAsk; onAsk: () => void }) {
  return (
    <button
      className="btn btn-primary fixed z-50 shadow-lg"
      style={{ left: at.x + 8, top: at.y + 10 }}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onAsk()
      }}
    >
      ✦ Ask Claude · {at.start === at.end ? `L${at.end}` : `L${at.start}–${at.end}`}
    </button>
  )
}
