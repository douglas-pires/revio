import type { Stack, StackPr, StackPrComments } from '@shared/inbox.types.ts'
import { isSamePull, type PullRef, pullKey } from '@shared/pull.types.ts'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { countOf, cx } from '../common/format.util.ts'
import type { OpenPull } from '../common/navigation.types.ts'
import { rememberStackScroll, stackScrollOf } from './stack-memory.util.ts'

/** The dot by each PR: waiting on you (red when stale), approved, changes requested, or neither. */
function dotOf(pr: StackPr) {
  if (pr.inbox === 'requested' && pr.stale) {
    return 'bg-danger'
  }
  if (pr.inbox === 'requested') {
    return 'bg-accent'
  }
  if (pr.reviewDecision === 'APPROVED') {
    return 'bg-ok'
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
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

/** Your comment summary for each PR of the stack, by `pullKey`. */
type CommentsByPull = Map<string, StackPrComments>

/** Where you commented across the stack, by PR; empty until it arrives (or when GitHub would not say). */
function useStackComments(stack: Stack): CommentsByPull {
  const [commentsByPull, setCommentsByPull] = useState<CommentsByPull>(() => new Map())
  useEffect(() => {
    let stillShown = true
    globalThis.revio
      .getStackComments(stack)
      .then((summaries) => {
        if (stillShown) {
          setCommentsByPull(new Map(summaries.map((summary) => [pullKey(summary), summary])))
        }
      })
      .catch(() => {
        // No markers; the stack bar works without them.
      })
    return () => {
      stillShown = false
    }
  }, [stack])
  return commentsByPull
}

/** The tooltip line about your comments on a PR, or nothing when you have none there. */
function describeYourComments(summary: StackPrComments | undefined) {
  if (!summary?.yourThreads) {
    return ''
  }
  let waitingText = ''
  if (summary.awaitingYou > 0) {
    waitingText = `, ${countOf(summary.awaitingYou, 'reply', 'replies')} waiting on you`
  }
  return `\nYou commented in ${countOf(summary.yourThreads, 'thread', 'threads')}${waitingText}`
}

/** 💬 and how many threads you commented in on this PR; highlighted while replies wait on you. */
function CommentsMarker({ summary }: { summary: StackPrComments | undefined }) {
  if (!summary?.yourThreads) {
    return null
  }
  if (summary.awaitingYou > 0) {
    return (
      <span className="chip shrink-0 bg-accent/15 py-0 font-mono text-[10.5px] text-accent">
        💬{summary.yourThreads} · {summary.awaitingYou} new
      </span>
    )
  }
  return <span className="shrink-0 font-mono text-[10.5px] text-muted">💬{summary.yourThreads}</span>
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

/** Whether an item is wholly outside the visible part of its scroller (a sliver showing still counts as in view). */
function isOutOfView(item: DOMRect, view: DOMRect) {
  return item.right <= view.left || item.left >= view.right
}

/** Marks the open PR in the chain, for screen readers and for scrolling it into view. */
function currentMarker(current: boolean): 'page' | undefined {
  let marker: 'page' | undefined
  if (current) {
    marker = 'page'
  }
  return marker
}

/** Every PR of the stack in order, the open one marked. */
function StackChain({ stack, index, onOpen }: { stack: Stack; index: number; onOpen: OpenPull }) {
  const scroller = useRef<HTMLDivElement>(null)
  const commentsByPull = useStackComments(stack)
  // Each PR's view draws a new bar: put it back where you had it scrolled, then bring the open PR into view if needed.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) {
      return
    }
    el.scrollLeft = stackScrollOf(stack)
    const open = el.querySelector('[aria-current="page"]')
    if (open && isOutOfView(open.getBoundingClientRect(), el.getBoundingClientRect())) {
      open.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    // Scroll events can arrive late; the bar's position as it goes is what the next PR's bar starts from.
    return () => rememberStackScroll(stack, el.scrollLeft)
  }, [stack])
  return (
    <div
      ref={scroller}
      onScroll={(event) => rememberStackScroll(stack, event.currentTarget.scrollLeft)}
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
    >
      {stack.nodes.map(({ pr, depth }, position) => {
        const current = position === index
        return (
          <span key={pr.id} className="flex shrink-0 items-center gap-1">
            {position > 0 && (
              <span className="text-muted">{separatorOf(depth, stack.nodes[position - 1]?.depth ?? depth)}</span>
            )}
            <button
              type="button"
              onClick={() => !current && onOpen(pr)}
              title={chainTitle(pr) + describeYourComments(commentsByPull.get(pullKey(pr)))}
              aria-current={currentMarker(current)}
              className={cx(
                'flex max-w-56 items-center gap-1.5 rounded px-1.5 py-0.5',
                current && 'bg-hover font-semibold text-fg ring-1 ring-accent/60',
                !current && 'text-muted hover:bg-hover hover:text-fg',
              )}
            >
              <span className={cx('size-1.5 shrink-0 rounded-full', dotOf(pr))} />
              <span className="font-mono">#{pr.number}</span>
              <span className="truncate">{pr.title}</span>
              <CommentsMarker summary={commentsByPull.get(pullKey(pr))} />
            </button>
          </span>
        )
      })}
    </div>
  )
}

/** The stack this PR belongs to: its place, the chain to jump along, and a warning when its base is unapproved. */
export function StackBar({ stack, pull, onOpen }: { stack: Stack; pull: PullRef; onOpen: OpenPull }) {
  const idx = stack.nodes.findIndex((node) => isSamePull(node.pr, pull))
  const me = stack.nodes[idx]?.pr
  const parent = me && stack.nodes.find((node) => node.pr.headRef === me.baseRef)?.pr
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
