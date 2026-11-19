import { useEffect, useState } from 'react'
import { cx, errorMessage } from '../common/format.util.ts'

type EditorButtonState = { kind: 'idle' | 'busy' } | { kind: 'failed'; reason: string }

/** How long a failure shows before the button returns to normal. */
const FAILURE_SHOWN_MS = 6000

function buttonTitle(state: EditorButtonState) {
  if (state.kind === 'failed') {
    return state.reason
  }
  return 'Open this file in your editor, from your local clone of the repository'
}

/** Opens the file from your local clone in your editor; a failure shows briefly, with the reason on hover. */
export function OpenInEditorButton({ onOpen }: { onOpen: () => Promise<void> }) {
  const [state, setState] = useState<EditorButtonState>({ kind: 'idle' })
  useEffect(() => {
    if (state.kind !== 'failed') {
      return
    }
    const t = setTimeout(() => setState({ kind: 'idle' }), FAILURE_SHOWN_MS)
    return () => clearTimeout(t)
  }, [state])
  const failed = state.kind === 'failed'
  return (
    <button
      type="button"
      className={cx(
        'btn btn-ghost shrink-0 py-0 text-[12px] whitespace-nowrap',
        failed && 'text-danger',
        !failed && 'text-muted hover:text-fg',
      )}
      title={buttonTitle(state)}
      disabled={state.kind === 'busy'}
      onClick={() => {
        setState({ kind: 'busy' })
        onOpen().then(
          () => setState({ kind: 'idle' }),
          (e) => setState({ kind: 'failed', reason: errorMessage(e) }),
        )
      }}
    >
      {Boolean(failed) && 'Could not open ⓘ'}
      {!failed && 'Open in editor'}
    </button>
  )
}
