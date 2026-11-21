import type { Stack, StackPr } from '@shared/inbox.types.ts'
import { EmptyState } from '../common/empty-state.component.tsx'
import { joinClassNames } from '../common/format.util.ts'
import type { OpenPull } from '../common/navigation.types.ts'
import { usePrefetchOnHover } from './use-prefetch-on-hover.hook.ts'

const AVATAR_PX = 24
const INDENT_BASE_PX = 12
const INDENT_STEP_PX = 20

/** Where a stack member stands for you: the dot's look and what it means. */
function describeStatus(pr: StackPr): { dot: string; title: string } {
  if (pr.inbox === 'requested' && pr.stale) {
    return { dot: 'border-danger bg-danger', title: 'Waiting on your review' }
  }
  if (pr.inbox === 'requested') {
    return { dot: 'border-accent bg-accent', title: 'Waiting on your review' }
  }
  if (pr.reviewDecision === 'APPROVED') {
    return { dot: 'border-ok bg-ok', title: 'Approved' }
  }
  return { dot: 'border-muted', title: '' }
}

function MemberChips({ pr }: { pr: StackPr }) {
  return (
    <>
      {Boolean(pr.isDraft) && <span className="chip bg-panel-2 text-muted">draft</span>}
      {Boolean(pr.inbox === 'requested' && pr.stale) && (
        <span className="chip bg-danger/15 text-danger">stale · needs you</span>
      )}
      {pr.inbox === 'requested' && !pr.stale && (
        <span className="chip bg-accent/15 text-accent">needs your review</span>
      )}
      {pr.inbox === 'reviewed' && <span className="chip bg-panel-2 text-muted">you reviewed</span>}
      {pr.inbox === null && <span className="chip bg-panel-2 text-muted">not requested</span>}
      {pr.reviewDecision === 'APPROVED' && <span className="chip bg-ok/15 text-ok">approved</span>}
      {pr.reviewDecision === 'CHANGES_REQUESTED' && (
        <span className="chip bg-danger/15 text-danger">changes requested</span>
      )}
    </>
  )
}

/** One PR of a stack, indented by depth, numbered in review order. Opens the PR. */
function StackMember({ pr, depth, order, onOpen }: { pr: StackPr; depth: number; order: number; onOpen: OpenPull }) {
  const prefetch = usePrefetchOnHover()
  const status = describeStatus(pr)
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        {...prefetch(pr)}
        onClick={() => onOpen(pr)}
        className={joinClassNames(
          'flex w-full cursor-pointer items-center gap-3 py-2 pr-4 text-left hover:bg-hover',
          pr.inbox === null && 'opacity-70',
        )}
        // biome-ignore lint/style/noInlineStyles: each PR is indented by its depth in the stack.
        style={{ paddingLeft: INDENT_BASE_PX + depth * INDENT_STEP_PX }}
      >
        <span className="w-4 shrink-0 text-center font-mono text-muted" aria-hidden={true}>
          {depth > 0 && '↳'}
        </span>
        <span title={status.title} className={joinClassNames('size-2.5 shrink-0 rounded-full border-2', status.dot)} />
        <img
          src={pr.authorAvatar}
          alt=""
          width={AVATAR_PX}
          height={AVATAR_PX}
          className="size-6 shrink-0 rounded-full bg-panel-2"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{pr.title}</span>
            <MemberChips pr={pr} />
          </span>
          <span
            className="mt-0.5 block truncate font-mono text-[11.5px] text-muted"
            title={`${pr.headRef} → ${pr.baseRef}`}
          >
            #{pr.number} · {pr.author} · {pr.headRef} → {pr.baseRef}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[11px] text-muted">{order}</span>
      </button>
    </li>
  )
}

function StackCard({ stack, focused, onOpen }: { stack: Stack; focused: boolean; onOpen: OpenPull }) {
  const waiting = stack.nodes.filter((node) => node.pr.inbox === 'requested').length
  return (
    <section
      id={`stack-${stack.id}`}
      className={joinClassNames(
        'overflow-hidden rounded-lg border bg-panel',
        focused && 'border-accent ring-1 ring-accent/40',
        !focused && 'border-line',
      )}
    >
      <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-2 text-[12px]">
        <span className="font-semibold">{stack.repo}</span>
        <span className="text-muted">
          {stack.nodes.length} PRs on <code className="text-fg">{stack.base}</code>
        </span>
        <div className="flex-1" />
        {waiting > 0 && <span className="chip bg-accent/15 text-accent">{waiting} waiting on you</span>}
      </header>
      <ol>
        {stack.nodes.map(({ pr, depth }, index) => (
          <StackMember key={pr.id} pr={pr} depth={depth} order={index + 1} onOpen={onOpen} />
        ))}
      </ol>
    </section>
  )
}

/** Stacked PRs in the inbox, each read bottom-up; `focus` is outlined after following a stack chip. */
export function StackList({
  stacks,
  filtering,
  focus,
  onOpen,
}: {
  stacks: readonly Stack[]
  filtering: boolean
  focus: string | null
  onOpen: OpenPull
}) {
  if (stacks.length === 0) {
    return (
      <EmptyState>
        {Boolean(filtering) && 'No stack has a PR matching this search.'}
        {!filtering &&
          'None of the PRs in your inbox are stacked. A stack is a PR whose base branch is another open PR’s branch.'}
      </EmptyState>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted">
        Stacks read bottom-up: review the PR closest to <code>{stacks[0]?.base ?? 'main'}</code> first, since everything
        above builds on it.
      </p>
      {stacks.map((stack) => (
        <StackCard key={stack.id} stack={stack} focused={focus === stack.id} onOpen={onOpen} />
      ))}
    </div>
  )
}
