import type { RaisedPoint, SharedReview } from '@shared/learn.types.ts'
import { useCallback, useState } from 'react'
import { EmptyState } from '../common/empty-state.component.tsx'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { countOf } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { MascotLoading } from '../common/mascot-loading.component.tsx'
import type { OpenPull } from '../common/navigation.types.ts'
import { useStoredChoice } from '../common/use-stored-choice.hook.ts'
import { CatchThemes } from './catch-themes.component.tsx'
import { useLoaded } from './use-loaded.hook.ts'

/** The repository most of these PRs are in: where a guide entry most likely belongs. */
function findMainRepo(reviews: readonly SharedReview[]) {
  const counts = new Map<string, number>()
  for (const review of reviews) {
    counts.set(review.repo, (counts.get(review.repo) ?? 0) + review.theyRaised.length)
  }
  return [...counts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '*'
}

/** Where a point is: "cart.ts:12", or just the file for a comment on the whole file. */
function describeSpot(point: RaisedPoint) {
  const name = point.path.slice(point.path.lastIndexOf('/') + 1)
  if (point.line === null) {
    return name
  }
  return `${name}:${point.line}`
}

function PointRow({ point }: { point: RaisedPoint }) {
  return (
    <li className="border-t border-line px-4 py-2 text-[12.5px]">
      <div className="flex items-baseline gap-2 text-[11.5px] text-muted">
        <span className="font-medium text-fg">{point.author}</span>
        <span className="font-mono" title={point.path}>
          {describeSpot(point)}
        </span>
        <a
          className="ml-auto hover:underline"
          href={point.url}
          onClick={(event) => {
            event.preventDefault()
            globalThis.revio.openExternal(point.url)
          }}
        >
          On GitHub ↗
        </a>
      </div>
      <div className="line-clamp-4">
        <Markdown className="text-[12.5px]" codePath={point.path}>
          {point.body}
        </Markdown>
      </div>
    </li>
  )
}

/** The arrow on the fold button: down when open. */
function describeFold(open: boolean) {
  if (open) {
    return '▾'
  }
  return '▸'
}

/** One PR: who else reviewed it, and the points they raised that you did not; folded until opened. */
function SharedReviewCard({ review, onOpen }: { review: SharedReview; onOpen: OpenPull }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="card mb-2 overflow-hidden">
      <div className="flex items-baseline gap-2 px-4 py-2.5 text-[12.5px]">
        <button
          type="button"
          className="min-w-0 truncate text-left font-medium hover:underline"
          onClick={() => onOpen(review)}
        >
          {review.title} <span className="font-normal text-muted">{`${review.repo}#${review.number}`}</span>
        </button>
        <span className="shrink-0 text-[11.5px] text-muted">with {review.reviewers.join(', ')}</span>
        <div className="flex-1" />
        {review.theyRaised.length > 0 && (
          <button type="button" className="btn btn-ghost shrink-0 py-0 text-accent" onClick={() => setOpen(!open)}>
            {countOf(review.theyRaised.length, 'point', 'points')} you didn’t raise {describeFold(open)}
          </button>
        )}
        {review.theyRaised.length === 0 && <span className="shrink-0 text-[11.5px] text-ok">nothing you missed</span>}
      </div>
      {Boolean(open) && (
        <ul>
          {review.theyRaised.map((point) => (
            <PointRow key={point.url} point={point} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Totals across the PRs, said as what happened rather than as a score. */
function Totals({ reviews }: { reviews: readonly SharedReview[] }) {
  const theirs = reviews.reduce((total, review) => total + review.theyRaised.length, 0)
  const yours = reviews.reduce((total, review) => total + review.onlyYou, 0)
  const both = reviews.reduce((total, review) => total + review.both, 0)
  return (
    <p className="mb-3 text-[12.5px] text-muted">
      On {countOf(reviews.length, 'PR', 'PRs')} others reviewed with you, they raised{' '}
      {countOf(theirs, 'point', 'points')} you didn’t, you raised {yours} nobody else did, and you both raised {both}.
      Every reviewer sees different things; theirs are worth a look.
    </p>
  )
}

const BOTS_CHOICES = ['without', 'with'] as const

/** Whether bots and AI reviewers count, as a switch remembered on this Mac. Off at first. */
function BotsSwitch({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-[12.5px] text-muted">
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      Include bots and AI reviewers (Copilot, Codex, Semgrep…)
    </label>
  )
}

/**
 * The PRs you reviewed alongside others: what they raised that you did not, and the kinds of things they catch.
 * Bots and AI reviewers are left out unless you include them.
 */
export function OtherReviewers({ onOpen }: { onOpen: OpenPull }) {
  const [bots, setBots] = useStoredChoice('revio.learnBots', BOTS_CHOICES, 'without')
  const includeBots = bots === 'with'
  const load = useCallback(() => globalThis.revio.listSharedReviews(includeBots), [includeBots])
  return (
    <>
      <BotsSwitch value={includeBots} onChange={(checked) => setBots(BOTS_CHOICES[Number(checked)] ?? 'without')} />
      <SharedReviews key={bots} load={load} includeBots={includeBots} onOpen={onOpen} />
    </>
  )
}

/** The comparison itself, for the reviewers counted. */
function SharedReviews(props: { load: () => Promise<SharedReview[]>; includeBots: boolean; onOpen: OpenPull }) {
  const { onOpen } = props
  const { value: reviews, error } = useLoaded(props.load)
  if (error !== null) {
    return <ErrorBanner>{error}</ErrorBanner>
  }
  if (reviews === null) {
    return <MascotLoading label="Comparing your reviews with your teammates’…" />
  }
  if (reviews.length === 0) {
    return (
      <EmptyState title="Nobody else commented">
        None of the PRs you reviewed recently had comments from another reviewer.
      </EmptyState>
    )
  }
  return (
    <>
      <Totals reviews={reviews} />
      <CatchThemes repo={findMainRepo(reviews)} includeBots={props.includeBots} />
      {reviews.map((review) => (
        <SharedReviewCard key={`${review.repo}#${review.number}`} review={review} onOpen={onOpen} />
      ))}
    </>
  )
}
