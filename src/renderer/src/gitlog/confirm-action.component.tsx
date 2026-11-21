import { useState } from 'react'
import { useAsyncAction } from '../common/use-async-action.hook.ts'

/** The button's text: the action, or that it is running. */
function describeButton(busy: boolean, label: string) {
  if (busy) {
    return 'Working…'
  }
  return label
}

/**
 * A button for an action that changes your clone: the first click asks (`question`, with Confirm and Cancel), the
 * second acts. While it runs the button is disabled; a failure shows under it in git's own words.
 */
export function ConfirmAction({
  label,
  question,
  onConfirm,
}: {
  label: string
  question: string
  onConfirm: () => Promise<void>
}) {
  const [asking, setAsking] = useState(false)
  const running = useAsyncAction()
  const confirm = () => {
    setAsking(false)
    running.run(onConfirm)
  }
  return (
    <div className="space-y-1 text-[12px]">
      {Boolean(!asking) && (
        <button type="button" className="btn" disabled={running.busy} onClick={() => setAsking(true)}>
          {describeButton(running.busy, label)}
        </button>
      )}
      {Boolean(asking) && (
        <div className="space-y-1">
          <div>{question}</div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={confirm}>
              Confirm
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {Boolean(running.error) && <div className="selectable text-danger">{running.error}</div>}
    </div>
  )
}
