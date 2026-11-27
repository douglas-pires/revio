import { useEffect, useState } from 'react'
import { joinClassNames } from './format.util.ts'

type CopyState = 'idle' | 'copied' | 'failed'

/** How long the confirmation shows before the icon returns. */
const CONFIRM_MS = 1500

const STATE_LOOK: Record<CopyState, { className: string; text: string }> = {
  idle: { className: 'text-muted', text: '⧉' },
  copied: { className: 'text-ok', text: '✓ copied' },
  failed: { className: 'text-danger', text: '✕ copy failed' },
}

/**
 * Copies `text` to the clipboard; the icon after the label confirms for a moment. `title` is its tooltip; without one
 * (when a shortcut hint explains it instead), `label` names it for screen readers.
 */
export function CopyButton(props: {
  text: string
  title?: string
  label?: string
  className?: string
  children: React.ReactNode
}) {
  const [state, setState] = useState<CopyState>('idle')
  useEffect(() => {
    if (state === 'idle') {
      return
    }
    const timer = setTimeout(() => setState('idle'), CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [state])
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.label ?? props.title}
      className={joinClassNames('no-drag', props.className)}
      onClick={() =>
        navigator.clipboard.writeText(props.text).then(
          () => setState('copied'),
          () => setState('failed'),
        )
      }
    >
      {props.children}{' '}
      <span aria-live="polite" className={STATE_LOOK[state].className}>
        {STATE_LOOK[state].text}
      </span>
    </button>
  )
}
