import { useEffect, useState } from 'react'
import { cx, errorMessage } from '../common/format.util'

/** Opens the file from your local clone in your editor; a failure shows briefly, with the reason on hover. */
export function OpenInEditorButton({ onOpen }: { onOpen: () => Promise<void> }) {
  const [state, setState] = useState<{ kind: 'idle' | 'busy' } | { kind: 'failed'; reason: string }>({ kind: 'idle' })
  useEffect(() => {
    if (state.kind !== 'failed') return
    const t = setTimeout(() => setState({ kind: 'idle' }), 6000)
    return () => clearTimeout(t)
  }, [state])
  const failed = state.kind === 'failed'
  return (
    <button
      className={cx('btn btn-ghost shrink-0 py-0 text-[12px] whitespace-nowrap', failed ? 'text-danger' : 'text-muted hover:text-fg')}
      title={failed ? state.reason : 'Open this file in your editor, from your local clone of the repository'}
      disabled={state.kind === 'busy'}
      onClick={() => {
        setState({ kind: 'busy' })
        onOpen().then(
          () => setState({ kind: 'idle' }),
          (e) => setState({ kind: 'failed', reason: errorMessage(e) }),
        )
      }}
    >
      {failed ? 'Could not open ⓘ' : 'Open in editor'}
    </button>
  )
}
