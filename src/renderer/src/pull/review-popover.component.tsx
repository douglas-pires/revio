import { useState } from 'react'
import type { PullDetail, ReviewEvent } from '@shared/pull.types'
import { cx, errorMessage } from '../common/format.util'

export function MyReviewChip({ review }: { review: NonNullable<PullDetail['myReview']> }) {
  const label =
    review.state === 'APPROVED' ? 'You approved' : review.state === 'CHANGES_REQUESTED' ? 'You requested changes' : review.state === 'DISMISSED' ? 'Your review was dismissed' : 'You commented'
  const tone = review.state === 'APPROVED' ? 'bg-ok/15 text-ok' : review.state === 'CHANGES_REQUESTED' ? 'bg-danger/15 text-danger' : 'bg-panel-2 text-muted'
  return (
    <span className={cx('chip no-drag whitespace-nowrap', tone)} title={review.submittedAt ? new Date(review.submittedAt).toLocaleString() : undefined}>
      {label}
      {review.stale && <span className="opacity-75">· new commits since</span>}
    </span>
  )
}

export function ReviewPopover(props: {
  initialEvent: ReviewEvent
  isAuthor: boolean
  body: string
  setBody: (b: string) => void
  draftCount: number
  onClose: () => void
  onSubmit: (event: ReviewEvent) => Promise<string>
}) {
  const [event, setEvent] = useState<ReviewEvent>(props.isAuthor ? 'COMMENT' : props.initialEvent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSubmit = !busy && !(event === 'COMMENT' && !props.body.trim() && props.draftCount === 0)
  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await props.onSubmit(event)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const options: { value: ReviewEvent; label: string; hint: string }[] = [
    { value: 'COMMENT', label: 'Comment', hint: 'General feedback without explicit approval.' },
    { value: 'APPROVE', label: 'Approve', hint: 'Give your approval to merge.' },
    { value: 'REQUEST_CHANGES', label: 'Request changes', hint: 'Feedback that must be addressed before merging.' },
  ]
  return (
    <div className="absolute top-full right-0 z-30 mt-2 w-[440px] rounded-lg border border-line bg-panel p-3 shadow-2xl">
      <textarea
        autoFocus
        className="input mb-2 min-h-28 resize-y"
        placeholder={event === 'APPROVE' ? 'Optional comment, e.g. LGTM 🚀' : 'Leave a summary comment (optional). ⌘↵ to submit'}
        value={props.body}
        onChange={(e) => props.setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.metaKey) void submit()
          if (e.key === 'Escape') props.onClose()
        }}
      />
      <div className="space-y-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx('flex gap-2 rounded px-1 py-1', props.isAuthor && o.value !== 'COMMENT' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-hover')}
          >
            <input
              type="radio"
              name="event"
              checked={event === o.value}
              disabled={props.isAuthor && o.value !== 'COMMENT'}
              onChange={() => setEvent(o.value)}
            />
            <span>
              <span className={cx('font-medium', o.value === 'APPROVE' && 'text-ok', o.value === 'REQUEST_CHANGES' && 'text-danger')}>{o.label}</span>
              <span className="block text-[12px] text-muted">
                {props.isAuthor && o.value !== 'COMMENT' ? "You can't approve or block your own pull request." : o.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error && <p className="selectable mt-2 text-danger">{error}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] text-muted">{props.draftCount} pending comment(s)</span>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={props.onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busy ? 'Submitting…' : event === 'APPROVE' ? '✓ Approve' : event === 'REQUEST_CHANGES' ? 'Request changes' : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  )
}

