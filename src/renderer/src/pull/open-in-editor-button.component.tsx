import { useEffect, useRef, useState } from 'react'
import { cx, errorMessage } from '../common/format.util.ts'

type EditorButtonState = { kind: 'idle' | 'busy' } | { kind: 'failed'; reason: string }

function buttonLabel(state: EditorButtonState) {
  if (state.kind === 'failed') {
    return 'Could not open'
  }
  return 'Open in editor'
}

/**
 * Why opening failed, under the button until you close it or try again. It is a popover anchored to the button: the
 * top layer is never clipped by the file card (which clips its contents to keep the header sticky).
 */
function FailureNote({
  reason,
  anchor,
  onClose,
}: {
  reason: string
  anchor: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const note = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = note.current
    // `source` makes the button the popover's anchor, which `position-area` places it against.
    if (anchor.current) {
      el?.showPopover({ source: anchor.current })
    } else {
      el?.showPopover()
    }
    return () => el?.hidePopover()
  }, [anchor])
  return (
    <div
      ref={note}
      popover="manual"
      role="alert"
      className="m-0 mt-1 flex w-80 items-start gap-2 rounded-md border border-danger/40 bg-panel p-2 text-[12px] whitespace-normal text-fg shadow-lg [inset:auto] [position-area:bottom_span-left]"
    >
      <span className="selectable min-w-0 flex-1">{reason}</span>
      <button type="button" className="btn btn-ghost px-1 py-0 text-muted" aria-label="Close" onClick={onClose}>
        ✕
      </button>
    </div>
  )
}

/** Opens the file from your local clone in your editor; a failure explains itself under the button. */
export function OpenInEditorButton({ onOpen }: { onOpen: () => Promise<void> }) {
  const [state, setState] = useState<EditorButtonState>({ kind: 'idle' })
  const button = useRef<HTMLButtonElement>(null)
  return (
    <span className="shrink-0">
      <button
        ref={button}
        type="button"
        data-open-in-editor=""
        className={cx(
          'btn btn-ghost py-0 text-[12px] whitespace-nowrap',
          state.kind === 'failed' && 'text-danger',
          state.kind !== 'failed' && 'text-muted hover:text-fg',
        )}
        title="Open this file in your editor, from your local clone of the repository"
        disabled={state.kind === 'busy'}
        onClick={() => {
          setState({ kind: 'busy' })
          onOpen().then(
            () => setState({ kind: 'idle' }),
            (e) => setState({ kind: 'failed', reason: errorMessage(e) }),
          )
        }}
      >
        {buttonLabel(state)}
      </button>
      {state.kind === 'failed' && (
        <FailureNote reason={state.reason} anchor={button} onClose={() => setState({ kind: 'idle' })} />
      )}
    </span>
  )
}
