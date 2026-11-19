import type { Stack, StackPr } from '@shared/inbox.types.ts'
import { isSamePull, type PullRef } from '@shared/pull.types.ts'
import { cx } from '../common/format.util.ts'
import type { OpenPull } from '../common/navigation.types.ts'

/** The dot by each PR: waiting on you (red when stale), approved, changes requested, or neither. */
function dotOf(p: StackPr) {
  if (p.inbox === 'requested' && p.stale) {
    return 'bg-danger'
  }
  if (p.inbox === 'requested') {
    return 'bg-accent'
  }
  if (p.reviewDecision === 'APPROVED') {
    return 'bg-ok'
  }
  if (p.reviewDecision === 'CHANGES_REQUESTED') {
    return 'bg-danger/60'
  }
  return 'bg-muted/50'
}

function prTitle(pr: StackPr | undefined) {
  if (!pr) {
    return
  }
  return `#${pr.number} ${pr.title}`
}

/** The tooltip on a chain entry: number, title, branches, and whether it was asked of you. */
function chainTitle(pr: StackPr) {
  let notRequested = ''
  if (!pr.inbox) {
    notRequested = '\n(not requested from you)'
  }
  return `#${pr.number} ${pr.title}\n${pr.headRef} → ${pr.baseRef}${notRequested}`
}

/** Between two PRs: › when the next one is stacked on top, · when it is a sibling. */
function separatorOf(depth: number, previousDepth: number) {
  if (depth > previousDepth) {
    return '›'
  }
  return '·'
}

function StepButton({ pr, label, onOpen }: { pr: StackPr | undefined; label: string; onOpen: OpenPull }) {
  return (
    <button
      type="button"
      className="btn btn-ghost shrink-0 py-0"
      disabled={!pr}
      onClick={() => pr && onOpen(pr)}
      title={prTitle(pr)}
    >
      {label}
    </button>
  )
}

/** Every PR of the stack in order, the open one marked. */
function StackChain({ stack, index, onOpen }: { stack: Stack; index: number; onOpen: OpenPull }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {stack.nodes.map(({ pr, depth }, i) => {
        const current = i === index
        return (
          <span key={pr.id} className="flex shrink-0 items-center gap-1">
            {i > 0 && <span className="text-muted">{separatorOf(depth, stack.nodes[i - 1]?.depth ?? depth)}</span>}
            <button
              type="button"
              onClick={() => !current && onOpen(pr)}
              title={chainTitle(pr)}
              className={cx(
                'flex max-w-56 items-center gap-1.5 rounded px-1.5 py-0.5',
                current && 'bg-hover font-semibold text-fg ring-1 ring-accent/60',
                !current && 'text-muted hover:bg-hover hover:text-fg',
              )}
            >
              <span className={cx('size-1.5 shrink-0 rounded-full', dotOf(pr))} />
              <span className="font-mono">#{pr.number}</span>
              <span className="truncate">{pr.title}</span>
            </button>
          </span>
        )
      })}
    </div>
  )
}

/** The stack this PR belongs to: its place, the chain to jump along, and a warning when its base is unapproved. */
export function StackBar({ stack, pull, onOpen }: { stack: Stack; pull: PullRef; onOpen: OpenPull }) {
  const idx = stack.nodes.findIndex((n) => isSamePull(n.pr, pull))
  const me = stack.nodes[idx]?.pr
  const parent = me && stack.nodes.find((n) => n.pr.headRef === me.baseRef)?.pr
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line bg-panel-2/60 px-4 py-1.5 text-[12px]">
      <span
        className="chip shrink-0 bg-accent/15 text-accent"
        title="Stacked PRs, bottom (closest to the default branch) first"
      >
        ⧉ Stack {idx + 1}/{stack.nodes.length}
      </span>
      <StepButton pr={stack.nodes[idx - 1]?.pr} label="‹ Prev" onOpen={onOpen} />
      <StackChain stack={stack} index={idx} onOpen={onOpen} />
      {parent !== undefined && parent.reviewDecision !== 'APPROVED' && (
        <span
          className="shrink-0 text-warn"
          title={`This PR's base branch is ${me?.baseRef}, the branch of #${parent.number}.`}
        >
          Builds on #{parent.number}, not approved yet
        </span>
      )}
      <StepButton pr={stack.nodes[idx + 1]?.pr} label="Next ›" onOpen={onOpen} />
    </div>
  )
}
