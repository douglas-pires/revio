import { COMMENT_KIND_LABELS } from '@shared/comment-kinds.util.ts'
import type { ReviewHabits } from '@shared/learn.types.ts'
import { useEffect, useState } from 'react'
import { EmptyState } from '../common/empty-state.component.tsx'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { countOf, joinClassNames } from '../common/format.util.ts'
import { MascotLoading } from '../common/mascot-loading.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { useAsyncAction } from '../common/use-async-action.hook.ts'
import { useLoaded } from './use-loaded.hook.ts'

const loadHabits = () => globalThis.revio.getReviewHabits()
const PERCENT = 100

function Tile({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="card flex-1 px-4 py-3">
      <div className="text-[20px] leading-7 font-semibold">{value}</div>
      <div className="text-[12px] text-muted">{label}</div>
    </div>
  )
}

/** A labelled bar, its length the count's share of the largest. */
function Bar({
  label,
  count,
  largest,
  mono = false,
}: {
  label: string
  count: number
  largest: number
  mono?: boolean
}) {
  return (
    <li className="flex items-center gap-3 text-[12.5px]">
      <span
        className={joinClassNames('shrink-0 truncate', mono && 'w-64 font-mono text-[11.5px]', !mono && 'w-44')}
        title={label}
      >
        {label}
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
        {/* biome-ignore lint/style/noInlineStyles: the bar's length is the data. */}
        <span className="block h-full rounded-full bg-accent" style={{ width: `${(count / largest) * PERCENT}%` }} />
      </span>
      <span className="w-8 shrink-0 text-right text-muted">{count}</span>
    </li>
  )
}

/** What your comments are about, once sorted; the button sorts them (or the rest) with Claude. */
function CommentKinds({ habits, onSorted }: { habits: ReviewHabits; onSorted: (habits: ReviewHabits) => void }) {
  const sorting = useAsyncAction()
  const sort = () => sorting.run(async () => onSorted(await globalThis.revio.sortCommentKinds()))
  const largest = habits.kinds[0]?.count ?? 1
  return (
    <section className="mb-6">
      <SectionHeading title="What your comments are about" hint={`${habits.sorted} of ${habits.comments} sorted`} />
      {habits.kinds.length > 0 && (
        <ul className="card mb-2 space-y-2 px-4 py-3">
          {habits.kinds.map(({ kind, count }) => (
            <Bar key={kind} label={COMMENT_KIND_LABELS[kind]} count={count} largest={largest} />
          ))}
        </ul>
      )}
      {habits.sorted < habits.comments && (
        <button type="button" className="btn text-accent" disabled={sorting.busy} onClick={sort}>
          {Boolean(sorting.busy) && 'Claude is sorting your comments…'}
          {!sorting.busy && habits.sorted === 0 && '✦ Sort my comments by kind'}
          {!sorting.busy && habits.sorted > 0 && '✦ Sort the rest'}
        </button>
      )}
      {habits.sorted === 0 && !sorting.busy && (
        <p className="mt-1 text-[12px] text-muted">Claude reads each comment once; what it finds is kept.</p>
      )}
      {Boolean(sorting.error) && <p className="mt-1 text-[12px] text-danger">{sorting.error}</p>}
    </section>
  )
}

/** The kinds of code concern you seldom raise, as something to look at on purpose. */
function RarelyChecked({ habits }: { habits: ReviewHabits }) {
  if (habits.rarelyChecked.length === 0) {
    return null
  }
  return (
    <section className="mb-6">
      <SectionHeading title="You seldom comment on" />
      <div className="card px-4 py-3 text-[12.5px]">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {habits.rarelyChecked.map((kind) => (
            <span key={kind} className="chip bg-warn/15 text-warn">
              {COMMENT_KIND_LABELS[kind]}
            </span>
          ))}
        </div>
        <p className="text-muted">
          Each is under 3% of your comments. That can be fine, since some code never touches them, but it is worth a
          deliberate look on the next PR where they matter.
        </p>
      </div>
    </section>
  )
}

function HabitsView({ habits, onSorted }: { habits: ReviewHabits; onSorted: (habits: ReviewHabits) => void }) {
  const largestFolder = habits.topFolders[0]?.count ?? 1
  return (
    <>
      <div className="mb-6 flex gap-3">
        <Tile value={habits.reviews} label={`reviews sent, on ${countOf(habits.pulls, 'PR', 'PRs')}`} />
        <Tile value={habits.comments} label="comments on code" />
        <Tile value={`${habits.silentApprovals} of ${habits.approvals}`} label="approvals without a comment on code" />
      </div>
      <CommentKinds habits={habits} onSorted={onSorted} />
      <RarelyChecked habits={habits} />
      {habits.topFolders.length > 0 && (
        <section className="mb-6">
          <SectionHeading title="Where you comment most" />
          <ul className="card space-y-2 px-4 py-3">
            {habits.topFolders.map(({ folder, count }) => (
              <Bar key={folder} label={folder} count={count} largest={largestFolder} mono={true} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** How you review, from your past reviews: what you comment on, what you seldom raise, and where. */
export function Habits() {
  const loaded = useLoaded(loadHabits)
  const [habits, setHabits] = useState<ReviewHabits | null>(null)
  useEffect(() => setHabits(loaded.value), [loaded.value])
  if (loaded.error !== null) {
    return <ErrorBanner>{loaded.error}</ErrorBanner>
  }
  if (habits === null) {
    return <MascotLoading label="Reading your past reviews…" />
  }
  if (habits.reviews === 0) {
    return <EmptyState title="No reviews yet">Reviews you send on others’ PRs show up here.</EmptyState>
  }
  return <HabitsView habits={habits} onSorted={setHabits} />
}
