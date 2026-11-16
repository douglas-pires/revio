import { isSamePull, type PullRef, type Stack } from '@shared/types'
import type { OpenPull } from '../common/navigation.types'
import { cx } from '../common/format.util'

export function StackBar({ stack, pull, onOpen }: { stack: Stack; pull: PullRef; onOpen: OpenPull }) {
  const idx = stack.nodes.findIndex((n) => isSamePull(n.pr, pull))
  const me = stack.nodes[idx]?.pr
  const parent = me && stack.nodes.find((n) => n.pr.headRef === me.baseRef)?.pr
  const prev = stack.nodes[idx - 1]?.pr
  const next = stack.nodes[idx + 1]?.pr
  const dot = (p: Stack['nodes'][number]['pr']) =>
    p.inbox === 'requested' ? (p.stale ? 'bg-danger' : 'bg-accent') : p.reviewDecision === 'APPROVED' ? 'bg-ok' : p.reviewDecision === 'CHANGES_REQUESTED' ? 'bg-danger/60' : 'bg-muted/50'
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line bg-panel-2/60 px-4 py-1.5 text-[12px]">
      <span className="chip shrink-0 bg-accent/15 text-accent" title="Stacked PRs, bottom (closest to the default branch) first">
        ⧉ Stack {idx + 1}/{stack.nodes.length}
      </span>
      <button className="btn btn-ghost shrink-0 py-0" disabled={!prev} onClick={() => prev && onOpen(prev)} title={prev ? `#${prev.number} ${prev.title}` : undefined}>
        ‹ Prev
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {stack.nodes.map(({ pr, depth }, i) => {
          const current = i === idx
          return (
            <span key={pr.id} className="flex shrink-0 items-center gap-1">
              {i > 0 && <span className="text-muted">{depth > stack.nodes[i - 1]!.depth ? '›' : '·'}</span>}
              <button
                onClick={() => !current && onOpen(pr)}
                title={`#${pr.number} ${pr.title}\n${pr.headRef} → ${pr.baseRef}${pr.inbox ? '' : '\n(not requested from you)'}`}
                className={cx(
                  'flex max-w-56 items-center gap-1.5 rounded px-1.5 py-0.5',
                  current ? 'bg-hover font-semibold text-fg ring-1 ring-accent/60' : 'text-muted hover:bg-hover hover:text-fg',
                )}
              >
                <span className={cx('size-1.5 shrink-0 rounded-full', dot(pr))} />
                <span className="font-mono">#{pr.number}</span>
                <span className="truncate">{pr.title}</span>
              </button>
            </span>
          )
        })}
      </div>
      {parent && parent.reviewDecision !== 'APPROVED' && (
        <span className="shrink-0 text-warn" title={`This PR's base branch is ${me!.baseRef}, the branch of #${parent.number}.`}>
          Builds on #{parent.number}, not approved yet
        </span>
      )}
      <button className="btn btn-ghost shrink-0 py-0" disabled={!next} onClick={() => next && onOpen(next)} title={next ? `#${next.number} ${next.title}` : undefined}>
        Next ›
      </button>
    </div>
  )
}

