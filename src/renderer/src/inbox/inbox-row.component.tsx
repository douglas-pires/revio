import type { PullSummary } from '@shared/inbox.types.ts'
import { buildPullKey } from '@shared/pull.types.ts'
import { useContext } from 'react'
import { formatAge, formatDuration, joinClassNames } from '../common/format.util.ts'
import { onActivateKey } from '../common/keyboard.util.ts'
import { MergeChips } from '../common/merge-chips.component.tsx'
import { MergeStatusesContext } from '../common/merge-statuses.context.ts'
import type { OpenPull } from '../common/navigation.types.ts'
import { usePrefetchOnHover } from './use-prefetch-on-hover.hook.ts'
import { describeVerdict } from './verdict-label.util.ts'
import { isLastBlocker } from './waiting-on-you.util.ts'

/** Size labels by changed lines (additions + deletions): below each limit, that label; XL above them all. */
const SIZE_LIMITS = { XS: 50, S: 200, M: 600, L: 1500 } as const

const AVATAR_PX = 28

/** The time at the end of a row: how long a review request has waited, or when the PR last changed. */
type RowTime = 'waiting' | 'updated'

function describeRequestTime(requestedAt: string | null) {
  if (!requestedAt) {
    return 'request time unknown'
  }
  return `requested ${new Date(requestedAt).toLocaleString()}`
}

function StackChip({ stack, onStack }: { stack: NonNullable<PullSummary['stack']>; onStack: (id: string) => void }) {
  return (
    <button
      type="button"
      className="chip bg-accent/15 text-accent hover:bg-accent/25"
      title={`Stacked PR: ${stack.position} of ${stack.size} from the bottom. Click to see the stack.`}
      onClick={(event) => {
        event.stopPropagation()
        onStack(stack.id)
      }}
    >
      ⧉ stack {stack.position}/{stack.size}
    </button>
  )
}

/** Where the reviews stand, and who said so; every name is in the tooltip. */
function VerdictChip({ pr }: { pr: PullSummary }) {
  if (pr.reviewDecision === 'APPROVED') {
    return (
      <span className="chip shrink-0 bg-ok/15 text-ok" title={pr.approvedBy.join(', ')}>
        {describeVerdict('approved', pr.approvedBy)}
      </span>
    )
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    return (
      <span className="chip shrink-0 bg-danger/15 text-danger" title={pr.changesRequestedBy.join(', ')}>
        {describeVerdict('changes requested', pr.changesRequestedBy)}
      </span>
    )
  }
  return null
}

/** What blocks the PR's merge, once its status has loaded. */
function RowMergeChips({ pr }: { pr: PullSummary }) {
  const { statuses, viewer } = useContext(MergeStatusesContext)
  const status = statuses[buildPullKey(pr)]
  if (!status) {
    return null
  }
  return (
    <>
      {viewer !== undefined && isLastBlocker(status, viewer, pr.viaTeam) && (
        <span className="chip shrink-0 bg-accent/15 text-accent" title="Only your review is left before this can merge">
          you're the last one
        </span>
      )}
      <MergeChips status={status} viewer={viewer} compact={true} />
    </>
  )
}

/** Opens the PR on GitHub, without opening it here. */
function GithubButton({ url }: { url: string }) {
  return (
    <button
      type="button"
      className="btn btn-ghost shrink-0 px-1.5 py-0.5 text-muted"
      title="Open on GitHub"
      aria-label="Open on GitHub"
      onClick={(event) => {
        event.stopPropagation()
        globalThis.revio.openExternal(url)
      }}
    >
      ↗
    </button>
  )
}

/** Size, then a time: how long the request has waited, or when the PR last changed. */
function RowStats({ pr, time }: { pr: PullSummary; time: RowTime }) {
  const updated = time === 'updated'
  return (
    <div className="flex shrink-0 items-center gap-3 font-mono text-[11.5px]">
      <span className="text-muted" title={`${pr.changedFiles} files`}>
        {pr.changedFiles}f
      </span>
      <span>
        <span className="text-ok">+{pr.additions}</span> <span className="text-danger">−{pr.deletions}</span>
      </span>
      <span className="chip w-7 justify-center bg-panel-2 text-muted">
        {pickSizeLabel(pr.additions + pr.deletions)}
      </span>
      {!updated && (
        <span
          className={joinClassNames(
            'w-12 text-right',
            pr.stale && 'font-semibold text-danger',
            !pr.stale && 'text-muted',
          )}
          title={describeRequestTime(pr.requestedAt)}
        >
          {formatDuration(pr.waitingHours)}
        </span>
      )}
      {Boolean(updated) && (
        <span className="w-12 text-right text-muted" title={`updated ${new Date(pr.updatedAt).toLocaleString()}`}>
          {formatAge(pr.updatedAt)}
        </span>
      )}
    </div>
  )
}

/** The time a row shows unless told otherwise: muted rows (already reviewed) show when the PR last changed. */
function pickDefaultRowTime(muted: boolean): RowTime {
  if (muted) {
    return 'updated'
  }
  return 'waiting'
}

/** A T-shirt size for a PR from how many lines it changes. */
function pickSizeLabel(changedLines: number) {
  return Object.entries(SIZE_LIMITS).find(([, limit]) => changedLines < limit)?.[0] ?? 'XL'
}

/** One PR in the queue: who and what, its chips, size and how long it has waited. Opens the PR. */
export function InboxRow({
  pr,
  onOpen,
  onStack,
  muted = false,
  time = pickDefaultRowTime(muted),
}: {
  pr: PullSummary
  onOpen: OpenPull
  onStack: (id: string) => void
  muted?: boolean | undefined
  /** How long a request has waited, or when the PR last changed. */
  time?: RowTime | undefined
}) {
  const prefetch = usePrefetchOnHover()
  const open = () => onOpen(pr)
  return (
    <li className="border-b border-line last:border-b-0">
      {/* biome-ignore lint/a11y/useSemanticElements: the row holds the stack button, and a <button> cannot hold another. */}
      <div
        role="button"
        tabIndex={0}
        {...prefetch(pr)}
        onClick={open}
        onKeyDown={onActivateKey(open)}
        className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-hover"
      >
        <img
          src={pr.authorAvatar}
          alt=""
          width={AVATAR_PX}
          height={AVATAR_PX}
          className="size-7 shrink-0 rounded-full bg-panel-2"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={joinClassNames('truncate font-medium', muted && 'text-muted')}>{pr.title}</span>
            {Boolean(pr.isDraft) && <span className="chip bg-panel-2 text-muted">draft</span>}
            {pr.stack !== undefined && <StackChip stack={pr.stack} onStack={onStack} />}
            {pr.viaTeam !== null && <span className="chip bg-panel-2 text-muted">@{pr.viaTeam}</span>}
            <VerdictChip pr={pr} />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
            <span className="min-w-0 truncate">
              {pr.repo}#{pr.number} · {pr.author} · {pr.headRef} → {pr.baseRef}
            </span>
            <RowMergeChips pr={pr} />
          </div>
        </div>
        <RowStats pr={pr} time={time} />
        <GithubButton url={pr.url} />
      </div>
    </li>
  )
}
