import { memo, useState } from 'react'
import type { OpenThread } from '@shared/types'
import type { ScrollTarget } from '../hooks/useScrollToTarget'
import { ago, cx, errorMessage } from '../lib/format'
import { excerpt } from '@shared/excerpt'
import { groupBy } from '../lib/group'
import { Composer } from './ReviewComments'

type OpenAt = (repo: string, number: number, target?: ScrollTarget) => void

export interface ThreadActions {
  onOpen: OpenAt
  onReply: (threadId: string, body: string) => Promise<void>
  onResolve: (threadId: string, resolved: boolean) => Promise<void>
}

interface Props extends ThreadActions {
  threads: readonly OpenThread[]
  resolved: ReadonlySet<string>
  filtering: boolean
}

/** Unresolved review threads, split by who owes the next reply and grouped by PR. */
export const ThreadList = memo(function ThreadList({ threads, resolved, filtering, ...actions }: Props) {
  if (!threads.length)
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-muted">
        {filtering ? 'No open thread matches this search.' : 'No unresolved review threads on your open PRs. 🎉'}
      </div>
    )
  return (
    <>
      <ThreadSection title="Waiting on your reply" hint="someone else spoke last" tone="accent" threads={threads.filter((t) => t.waitingOn === 'you')} resolved={resolved} actions={actions} />
      <ThreadSection title="Waiting on others" hint="your comment has no answer yet" threads={threads.filter((t) => t.waitingOn === 'others')} resolved={resolved} actions={actions} />
    </>
  )
})

function ThreadSection(props: { title: string; hint: string; tone?: 'accent'; threads: OpenThread[]; resolved: ReadonlySet<string>; actions: ThreadActions }) {
  if (!props.threads.length) return null
  const open = props.threads.filter((t) => !props.resolved.has(t.id)).length
  const byPr = groupBy(props.threads, (t) => `${t.repo}#${t.number}`)
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-baseline gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
        <span className={props.tone === 'accent' ? 'text-accent' : ''}>{props.title}</span>
        <span className="font-normal normal-case">{open}</span>
        <span className="font-normal tracking-normal normal-case">· {props.hint}</span>
      </h2>
      <div className="space-y-3">
        {[...byPr.values()].map((list) => (
          <PrThreads key={list[0]!.id} threads={list} resolved={props.resolved} actions={props.actions} />
        ))}
      </div>
    </section>
  )
}

function PrThreads({ threads, resolved, actions }: { threads: OpenThread[]; resolved: ReadonlySet<string>; actions: ThreadActions }) {
  const pr = threads[0]!
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      <button className="flex w-full items-center gap-2 border-b border-line bg-panel-2 px-4 py-2 text-left text-[12px] hover:bg-hover" onClick={() => actions.onOpen(pr.repo, pr.number)}>
        <span className="truncate font-semibold">{pr.prTitle}</span>
        {pr.isDraft && <span className="chip bg-panel text-muted">draft</span>}
        <span className="shrink-0 text-muted">
          {pr.repo}#{pr.number} · {pr.prAuthor}
        </span>
      </button>
      <ul>
        {threads.map((t) => (
          <ThreadRow key={t.id} thread={t} isResolved={resolved.has(t.id)} actions={actions} />
        ))}
      </ul>
    </div>
  )
}

function ThreadRow({ thread: t, isResolved, actions }: { thread: OpenThread; isResolved: boolean; actions: ThreadActions }) {
  const [replying, setReplying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const last = t.comments.at(-1)!

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const sendReply = (body: string) =>
    run(async () => {
      await actions.onReply(t.id, body)
      setReplying(false)
    })

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="group/row flex gap-3 px-4 py-2.5 hover:bg-hover">
        <button
          className={cx('flex min-w-0 flex-1 gap-3 text-left', isResolved && 'opacity-50')}
          onClick={() => actions.onOpen(t.repo, t.number, { path: t.path, line: t.line })}
          title={t.outdated ? 'The code this thread was on has changed since; opens the file.' : 'Open the PR at this line'}
        >
          <img src={last.authorAvatar} alt="" className="mt-0.5 size-6 shrink-0 rounded-full bg-panel-2" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[12px]">
              <code className="truncate">
                {t.path}
                {t.line ? `:${t.line}` : ''}
              </code>
              {t.outdated && <span className="chip bg-panel-2 text-muted">outdated</span>}
              {last.bot && <span className="chip bg-panel-2 text-muted">bot</span>}
              <span className="shrink-0 text-muted">
                {t.totalComments} comment{t.totalComments === 1 ? '' : 's'}
              </span>
            </div>
            <div className={cx('mt-0.5 line-clamp-2 text-[12.5px]', t.waitingOn === 'others' && 'text-muted')}>
              <span className="font-medium">{last.author}</span>: {excerpt(last.body)}
            </div>
          </div>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[11.5px] text-muted">{ago(t.lastActivityAt)}</span>
          {isResolved ? (
            <span className="flex items-center gap-1 text-[11.5px] text-ok">
              Resolved
              <button className="btn btn-ghost py-0 text-[11.5px]" disabled={busy} onClick={() => void run(() => actions.onResolve(t.id, false))}>
                Undo
              </button>
            </span>
          ) : (
            <span className="flex gap-1">
              <button className="btn btn-ghost py-0 text-[11.5px]" disabled={busy || replying} onClick={() => setReplying(true)}>
                Reply
              </button>
              <button className="btn btn-ghost py-0 text-[11.5px]" disabled={busy} onClick={() => void run(() => actions.onResolve(t.id, true))}>
                {busy && !replying ? 'Resolving…' : 'Resolve'}
              </button>
            </span>
          )}
        </div>
      </div>
      {(replying || error) && (
        <div className="space-y-2 px-4 pb-3 pl-13">
          {replying && <Composer label={`Reply to ${last.author}`} onCancel={() => setReplying(false)} onSubmitNow={sendReply} />}
          {error && <div className="text-[12px] text-danger selectable">{error}</div>}
        </div>
      )}
    </li>
  )
}
