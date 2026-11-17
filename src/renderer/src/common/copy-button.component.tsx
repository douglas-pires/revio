import { useEffect, useState } from 'react'
import { cx } from './format.util'

/** Copies `text` to the clipboard; the icon after the label confirms for a moment. */
export function CopyButton(props: { text: string; title: string; className?: string; children: React.ReactNode }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const t = setTimeout(() => setState('idle'), 1500)
    return () => clearTimeout(t)
  }, [state])
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.title}
      className={cx('no-drag', props.className)}
      onClick={() =>
        navigator.clipboard.writeText(props.text).then(
          () => setState('copied'),
          () => setState('failed'),
        )
      }
    >
      {props.children}{' '}
      <span aria-live="polite" className={state === 'copied' ? 'text-ok' : state === 'failed' ? 'text-danger' : 'text-muted'}>
        {state === 'copied' ? '✓ copied' : state === 'failed' ? '✕ copy failed' : '⧉'}
      </span>
    </button>
  )
}
