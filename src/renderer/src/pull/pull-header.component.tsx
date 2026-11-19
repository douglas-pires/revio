import type { PullDetail, ReviewEvent } from '@shared/pull.types.ts'
import { countOf } from '../common/format.util.ts'
import { BranchNames } from './branch-names.component.tsx'
import { MyReviewChip, ReviewPopover } from './review-popover.component.tsx'

const AVATAR_PX = 28

/** Approve opens the popover to approve, or closes it when it is already open for that. */
function toggledEvent(open: ReviewEvent | false, event: ReviewEvent): ReviewEvent | false {
  if (open === event) {
    return false
  }
  return event
}

/** Finish review closes the popover when it is open (whatever it opened for), else opens it to comment. */
function closedOr(open: ReviewEvent | false, event: ReviewEvent): ReviewEvent | false {
  if (open) {
    return false
  }
  return event
}

export function PullHeader(props: {
  pr: PullDetail
  draftCount: number
  askCount: number
  onOpenAsks: () => void
  onBack: () => void
  /** Which review action the submit popover opens with, or false when closed. */
  reviewOpen: ReviewEvent | false
  setReviewOpen: (open: ReviewEvent | false) => void
  reviewBody: string
  setReviewBody: (body: string) => void
  onSubmitReview: (event: ReviewEvent) => Promise<string>
}) {
  const { pr, reviewOpen, setReviewOpen } = props
  const isAuthor = pr.author === pr.viewer
  const approvedAlready = pr.myReview?.state === 'APPROVED' && !pr.myReview.stale
  return (
    <header className="drag flex shrink-0 items-center gap-3 border-b border-line px-4 py-2">
      <button type="button" className="btn btn-ghost no-drag" onClick={props.onBack}>
        ←
      </button>
      <img src={pr.authorAvatar} alt="" width={AVATAR_PX} height={AVATAR_PX} className="size-7 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="selectable no-drag truncate text-[14px] font-semibold">
          {pr.title} <span className="font-normal text-muted">#{pr.number}</span>
        </div>
        <div className="truncate text-[12px] text-muted">
          {pr.repo} · {pr.author} wants to merge <BranchNames head={pr.headRef} base={pr.baseRef} /> ·{' '}
          <span className="text-ok">+{pr.additions}</span> <span className="text-danger">−{pr.deletions}</span>
        </div>
      </div>
      {props.askCount > 0 && (
        <button type="button" className="btn no-drag" onClick={props.onOpenAsks}>
          ✦ {countOf(props.askCount, 'Claude chat', 'Claude chats')}
        </button>
      )}
      <button type="button" className="btn no-drag" onClick={() => globalThis.revio.openExternal(pr.url)}>
        GitHub ↗
      </button>
      {pr.myReview !== null && <MyReviewChip review={pr.myReview} />}
      <div className="no-drag relative flex gap-2">
        {!(isAuthor || approvedAlready) && (
          <button
            type="button"
            className="btn border-ok/50 text-ok hover:bg-ok/10"
            onClick={() => setReviewOpen(toggledEvent(reviewOpen, 'APPROVE'))}
            title="Approve this pull request"
          >
            ✓ {pr.myReview?.state === 'APPROVED' && 'Re-approve'}
            {!(pr.myReview?.state === 'APPROVED') && 'Approve'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setReviewOpen(closedOr(reviewOpen, 'COMMENT'))}
        >
          Finish review{Boolean(props.draftCount) && ` (${props.draftCount})`}
        </button>
        {reviewOpen !== false && (
          <ReviewPopover
            key={reviewOpen}
            initialEvent={reviewOpen}
            isAuthor={isAuthor}
            body={props.reviewBody}
            setBody={props.setReviewBody}
            draftCount={props.draftCount}
            onClose={() => setReviewOpen(false)}
            onSubmit={props.onSubmitReview}
          />
        )}
      </div>
    </header>
  )
}
