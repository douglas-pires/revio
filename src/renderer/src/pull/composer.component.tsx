import { useEffect, useState } from 'react'
import { cx } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { markdownLinkFor } from '../common/markdown-link.util.ts'
import { forgetUnsentComment, keepUnsentComment, unsentComment } from './unsent-comments.util.ts'

interface ComposerProps {
  label: string
  initial?: string
  suggestion?: string | undefined
  /** The file being commented on, so the preview highlights ```suggestion blocks. */
  codePath?: string | undefined
  /**
   * Names this box so what you type survives closing it: Escape or clicking away keeps the text, and the box shows it
   * again when it reopens. Cancel and sending forget it. Without a key, closing the box drops the text.
   */
  unsentKey?: string | undefined
  onCancel: () => void
  /** Adds the comment to your pending review. Without it, the box only replies right away. */
  onSubmit?: (body: string) => void
  onSubmitNow?: (body: string) => Promise<void>
  onAsk?: () => void
  /** Adds the selected lines to the open Claude chat, for its next question. */
  onAddToChat?: (() => void) | undefined
}

/** The comment with a GitHub suggestion block of `lines` added on a new line. */
function withSuggestion(body: string, lines: string | undefined) {
  const block = `\`\`\`suggestion\n${lines}\n\`\`\`\n`
  if (!body) {
    return block
  }
  return `${body}\n${block}`
}

/** Forgets the box's kept text, when it has a key. */
function forget(key: string | undefined) {
  if (key !== undefined) {
    forgetUnsentComment(key)
  }
}

/** What the box opens with: the text you left in it last time, else its `initial`. */
function openingBody(props: ComposerProps) {
  if (props.unsentKey !== undefined) {
    return unsentComment(props.unsentKey) ?? props.initial ?? ''
  }
  return props.initial ?? ''
}

/** Pasting a link over selected words writes `[words](link)`, as on GitHub. */
function pasteAsLink(event: React.ClipboardEvent<HTMLTextAreaElement>) {
  const box = event.currentTarget
  const link = markdownLinkFor(
    box.value.slice(box.selectionStart, box.selectionEnd),
    event.clipboardData.getData('text/plain'),
  )
  if (link === null) {
    return
  }
  event.preventDefault()
  // Inserted through the browser's own editing, so ⌘Z undoes it in one step and React sees the change.
  document.execCommand('insertText', false, link)
}

/** What ⌘↵ does: add to the pending review, or send the reply right away. */
function submitVerb(addsToReview: boolean) {
  if (addsToReview) {
    return 'add'
  }
  return 'send'
}

/** The label, Write / Preview, and the shortcuts to ask Claude or insert a suggestion. */
function ComposerToolbar({
  props,
  preview,
  setPreview,
  setBody,
}: {
  props: ComposerProps
  preview: boolean
  setPreview: (preview: boolean) => void
  setBody: (change: (body: string) => string) => void
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1 text-[11.5px] text-muted">
      <span className="mr-2">{props.label}</span>
      <button
        type="button"
        className={cx('btn btn-ghost py-0', !preview && 'bg-hover')}
        onClick={() => setPreview(false)}
      >
        Write
      </button>
      <button
        type="button"
        className={cx('btn btn-ghost py-0', preview && 'bg-hover')}
        onClick={() => setPreview(true)}
      >
        Preview
      </button>
      <div className="flex-1" />
      {props.onAsk !== undefined && (
        <button
          type="button"
          className="btn btn-ghost py-0 text-accent"
          title="Ask Claude about the selected lines"
          onClick={props.onAsk}
        >
          ✦ Ask Claude
        </button>
      )}
      {props.onAddToChat !== undefined && (
        <button
          type="button"
          className="btn btn-ghost py-0 text-accent"
          title="Add the selected lines to your open chat with Claude, for the next question"
          onClick={props.onAddToChat}
        >
          + Add to chat
        </button>
      )}
      {props.suggestion !== undefined && (
        <button
          type="button"
          className="btn btn-ghost py-0"
          title="Insert a GitHub suggestion block with the selected lines"
          onClick={() => setBody((body) => withSuggestion(body, props.suggestion))}
        >
          ± Suggest change
        </button>
      )}
    </div>
  )
}

/** Cancel, Reply now (when the box can send right away) and Add to review / Update (when it adds a draft). */
function ComposerButtons({
  props,
  body,
  busy,
  sendNow,
  submit,
  discard,
}: {
  props: ComposerProps
  body: string
  busy: boolean
  sendNow: () => void
  submit: () => void
  discard: () => void
}) {
  return (
    <div className="mt-1.5 flex justify-end gap-2">
      <button type="button" className="btn btn-ghost" title="Close and throw away what you wrote" onClick={discard}>
        Cancel
      </button>
      {props.onSubmitNow !== undefined && (
        <button
          type="button"
          className={cx('btn', !props.onSubmit && 'btn-primary')}
          disabled={!body.trim() || busy}
          onClick={sendNow}
        >
          {Boolean(busy) && 'Sending…'}
          {!busy && 'Reply now'}
        </button>
      )}
      {props.onSubmit !== undefined && (
        <button type="button" className="btn btn-primary" disabled={!body.trim()} onClick={submit}>
          {Boolean(props.initial) && 'Update'}
          {!props.initial && 'Add to review'}
        </button>
      )}
    </div>
  )
}

export function Composer(props: ComposerProps) {
  const [restored] = useState(() => props.unsentKey !== undefined && unsentComment(props.unsentKey) !== undefined)
  const [body, setBody] = useState(() => openingBody(props))
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const { unsentKey } = props
  const initial = props.initial ?? ''
  // Every change is kept as you type, so however the box closes (Escape, a click elsewhere, leaving the PR), it is there.
  useEffect(() => {
    if (unsentKey !== undefined) {
      keepUnsentComment(unsentKey, body, initial)
    }
  }, [unsentKey, body, initial])
  const sendNow = async () => {
    if (!(props.onSubmitNow && body.trim()) || busy) {
      return
    }
    setBusy(true)
    try {
      await props.onSubmitNow(body.trim())
      forget(unsentKey)
    } finally {
      setBusy(false)
    }
  }
  const submit = () => {
    if (!props.onSubmit) {
      sendNow()
    } else if (body.trim()) {
      forget(unsentKey)
      props.onSubmit(body.trim())
    }
  }
  const discard = () => {
    forget(unsentKey)
    props.onCancel()
  }
  return (
    <div className="rounded-md border border-accent/50 bg-panel p-2">
      <ComposerToolbar props={props} preview={preview} setPreview={setPreview} setBody={setBody} />
      {Boolean(restored) && (
        <div className="mb-1.5 text-[11.5px] text-muted">Your unsent comment from before. Cancel throws it away.</div>
      )}
      {Boolean(preview) && (
        <div className="min-h-20 rounded-md border border-line p-2">
          <Markdown className="text-[12.5px]" codePath={props.codePath}>
            {body || '_Nothing to preview_'}
          </Markdown>
        </div>
      )}
      {!preview && (
        <textarea
          // biome-ignore lint/a11y/noAutofocus: the composer opens because the reviewer chose to write; focus goes where they type.
          autoFocus={true}
          aria-label={props.label}
          // Grows with what you type or paste, up to most of the window, then scrolls.
          className="input max-h-[60vh] min-h-20 resize-y font-sans [field-sizing:content]"
          placeholder={`Leave a comment (markdown). ⌘↵ to ${submitVerb(Boolean(props.onSubmit))}, Esc to close and keep it`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onPaste={pasteAsLink}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.metaKey) {
              submit()
            }
            if (event.key === 'Escape') {
              props.onCancel()
            }
          }}
        />
      )}
      <ComposerButtons props={props} body={body} busy={busy} sendNow={sendNow} submit={submit} discard={discard} />
    </div>
  )
}
