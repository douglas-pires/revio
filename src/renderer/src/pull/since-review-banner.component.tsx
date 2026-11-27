import type { SinceReview } from '@shared/pull.types.ts'
import { countOf } from '../common/format.util.ts'
import type { SinceReviewState } from './use-since-review.hook.ts'

const SHORT_SHA = 7

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** What the view shows: since when, which commit, how many files, and where comments can go. */
function describeSince(since: SinceReview) {
  const files = countOf(since.files.length, 'file', 'files')
  return `What changed since your review on ${formatDay(since.reviewedAt)} (${since.reviewedSha.slice(0, SHORT_SHA)}): ${files}. Comments can go on the lines in green and the unchanged lines around them, when they are part of the PR.`
}

/** Above the diff while only the changes since your review show: what they are, or why there are none. */
export function SinceReviewBanner({ sinceReview }: { sinceReview: SinceReviewState }) {
  if (!sinceReview.on) {
    return null
  }
  const { since, error } = sinceReview
  return (
    <div className="mx-4 mt-4 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-[12.5px]">
      {error !== null && <p className="text-danger">{error}</p>}
      {error === null && since === null && <p className="text-muted">Loading the changes since your review…</p>}
      {since !== null && <p>{describeSince(since)}</p>}
      {since?.rebased === true && (
        <p className="mt-1 text-muted">
          The branch was rebased or merged with its base since, so changes from the base can show in these files too.
        </p>
      )}
      {since !== null && since.files.length === 0 && (
        <p className="mt-1 text-muted">None of the PR’s files changed since; only the base did.</p>
      )}
    </div>
  )
}
