import type { PullDetail, ReviewEvent } from '@shared/pull.types.ts'

import { useState } from 'react'

import { cx, errorMessage } from '../common/format.util.ts'

type ReviewState = NonNullable<PullDetail['myReview']>['state']

const MY_REVIEW_LOOK: Record<ReviewState, { label: string; tone: string }> = {
  APPROVED: { label: 'You approved', tone: 'bg-ok/15 text-ok' },
  CHANGES_REQUESTED: { label: 'You requested changes', tone: 'bg-danger/15 text-danger' },
  DISMISSED: { label: 'Your review was dismissed', tone: 'bg-panel-2 text-muted' },
  COMMENTED: { label: 'You commented', tone: 'bg-panel-2 text-muted' },
}

const EVENTS: readonly { value: ReviewEvent; label: string; hint: string; submit: string; tone: string }[] = [
  {
    value: 'COMMENT',
    label: 'Comment',
    hint: 'General feedback without explicit approval.',
    submit: 'Submit review',
    tone: '',
  },
  { value: 'APPROVE', label: 'Approve', hint: 'Give your approval to merge.', submit: '✓ Approve', tone: 'text-ok' },
  {
    value: 'REQUEST_CHANGES',
    label: 'Request changes',
    hint: 'Feedback that must be addressed before merging.',
    submit: 'Request changes',
    tone: 'text-danger',
  },
]

/** When you submitted the review, for its tooltip. */
function submittedTitle(submittedAt: string) {
  if (!submittedAt) {
    return
  }
  return new Date(submittedAt).toLocaleString()
}

/** The text of the submit button for the chosen event. */
function submitLabel(event: ReviewEvent, busy: boolean) {
  if (busy) {
    return 'Submitting…'
  }
  return EVENTS.find((choice) => choice.value === event)?.submit ?? 'Submit review'
}

/** Authors can only comment on their own pull request; others start from the event they picked. */
function startingEvent(isAuthor: boolean, picked: ReviewEvent): ReviewEvent {
  if (isAuthor) {
    return 'COMMENT'
  }
  return picked
}

function placeholderFor(event: ReviewEvent) {
  if (event === 'APPROVE') {
    return 'Optional comment, e.g. LGTM 🚀'
  }
  return 'Leave a summary comment (optional). ⌘↵ to submit'
}

/** The review kinds as radio buttons; an author can only comment on their own pull request. */
function EventChoices({
  event,
  isAuthor,
  onChange,
}: {
  event: ReviewEvent
  isAuthor: boolean
  onChange: (event: ReviewEvent) => void
}) {
  return (
    <div className="space-y-1">
      {EVENTS.map((choice) => {
        const blocked = isAuthor && choice.value !== 'COMMENT'
        return (
          <label
            key={choice.value}
            className={cx(
              'flex gap-2 rounded px-1 py-1',
              blocked && 'cursor-not-allowed opacity-50',
              !blocked && 'cursor-pointer hover:bg-hover',
            )}
          >
            <input
              type="radio"
              name="event"
              checked={event === choice.value}
              disabled={blocked}
              onChange={() => onChange(choice.value)}
            />
            <span>
              <span className={cx('font-medium', choice.tone)}>{choice.label}</span>
              <span className="block text-[12px] text-muted">
                {Boolean(blocked) && "You can't approve or block your own pull request."}
                {!blocked && choice.hint}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** Submits the review once; tracks whether it is in flight and why it failed. */
function useSubmitReview(onSubmit: (event: ReviewEvent) => Promise<string>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: ReviewEvent) => {
    setBusy(true)
    setError(null)
    try {
      await onSubmit(event)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, submit }
}

export function MyReviewChip({ review }: { review: NonNullable<PullDetail['myReview']> }) {
  const look = MY_REVIEW_LOOK[review.state]
  return (
    <span className={cx('chip no-drag whitespace-nowrap', look.tone)} title={submittedTitle(review.submittedAt)}>
      {look.label}
      {Boolean(review.stale) && <span className="opacity-75">· new commits since</span>}
    </span>
  )
}

export function ReviewPopover(props: {
  initialEvent: ReviewEvent
  isAuthor: boolean
  body: string
  setBody: (body: string) => void
  draftCount: number
  onClose: () => void
  onSubmit: (event: ReviewEvent) => Promise<string>
}) {
  const [event, setEvent] = useState(() => startingEvent(props.isAuthor, props.initialEvent))
  const { busy, error, submit } = useSubmitReview(props.onSubmit)
  // A plain comment review needs something to say: a summary or at least one pending comment.
  const empty = event === 'COMMENT' && !props.body.trim() && props.draftCount === 0
  const canSubmit = !(busy || empty)
  const submitIfReady = () => {
    if (canSubmit) {
      submit(event)
    }
  }
  return (
    <div className="absolute top-full right-0 z-30 mt-2 w-[440px] rounded-lg border border-line bg-panel p-3 shadow-2xl">
      <textarea
        // biome-ignore lint/a11y/noAutofocus: the popover opens because the reviewer chose to finish the review; focus goes where they type.
        autoFocus={true}
        className="input mb-2 min-h-28 resize-y"
        placeholder={placeholderFor(event)}
        value={props.body}
        onChange={(changeEvent) => props.setBody(changeEvent.target.value)}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === 'Enter' && keyEvent.metaKey) {
            submitIfReady()
          }
          if (keyEvent.key === 'Escape') {
            props.onClose()
          }
        }}
      />
      <EventChoices event={event} isAuthor={props.isAuthor} onChange={setEvent} />
      {error !== null && <p className="selectable mt-2 text-danger">{error}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] text-muted">{props.draftCount} pending comment(s)</span>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={props.onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={submitIfReady}>
            {submitLabel(event, busy)}
          </button>
        </div>
      </div>
    </div>
  )
}
