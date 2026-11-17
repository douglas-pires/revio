import type { PullDetail, ReviewEvent } from '@shared/pull.types'
import { MyReviewChip, ReviewPopover } from './review-popover.component'

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
      <button className="btn btn-ghost no-drag" onClick={props.onBack}>
        ←
      </button>
      <img src={pr.authorAvatar} alt="" className="size-7 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="selectable no-drag truncate text-[14px] font-semibold">
          {pr.title} <span className="font-normal text-muted">#{pr.number}</span>
        </div>
        <div className="truncate text-[12px] text-muted">
          {pr.repo} · {pr.author} wants to merge <code className="text-fg">{pr.headRef}</code> into <code className="text-fg">{pr.baseRef}</code> ·{' '}
          <span className="text-ok">+{pr.additions}</span> <span className="text-danger">−{pr.deletions}</span>
        </div>
      </div>
      {props.askCount > 0 && (
        <button className="btn no-drag" onClick={props.onOpenAsks}>
          ✦ {props.askCount} Claude chat{props.askCount > 1 ? 's' : ''}
        </button>
      )}
      <button className="btn no-drag" onClick={() => void window.revio.openExternal(pr.url)}>
        GitHub ↗
      </button>
      {pr.myReview && <MyReviewChip review={pr.myReview} />}
      <div className="no-drag relative flex gap-2">
        {!isAuthor && !approvedAlready && (
          <button
            className="btn border-ok/50 text-ok hover:bg-ok/10"
            onClick={() => setReviewOpen(reviewOpen === 'APPROVE' ? false : 'APPROVE')}
            title="Approve this pull request"
          >
            ✓ {pr.myReview?.state === 'APPROVED' ? 'Re-approve' : 'Approve'}
          </button>
        )}
        <button className="btn btn-primary" onClick={() => setReviewOpen(reviewOpen ? false : 'COMMENT')}>
          Finish review{props.draftCount ? ` (${props.draftCount})` : ''}
        </button>
        {reviewOpen && (
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
