import { summarizeComment } from '@shared/excerpt.util.ts'
import { reviewCommentIdFromUrl } from '@shared/github-url.util.ts'
import type { OpenThread } from '@shared/thread.types.ts'
import { memo, useState } from 'react'
import { EmptyState } from '../common/empty-state.component.tsx'
import { ago, countOf, cx } from '../common/format.util.ts'
import { groupBy } from '../common/group.util.ts'
import type { OpenPull } from '../common/navigation.types.ts'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { useAsyncAction } from '../common/use-async-action.hook.ts'
import { Composer } from '../pull/composer.component.tsx'

interface Props extends ThreadActions {
  threads: readonly OpenThread[]
  resolved: ReadonlySet<string>
  filtering: boolean
}

function ThreadSection(props: {
  title: string
  hint: string
  tone?: 'accent' | undefined
  threads: OpenThread[]
  resolved: ReadonlySet<string>
  actions: ThreadActions
}) {
  if (props.threads.length === 0) {
    return null
  }
  const open = props.threads.filter((t) => !props.resolved.has(t.id)).length
  const byPr = groupBy(props.threads, (t) => `${t.repo}#${t.number}`)
  return (
    <section className="mb-6">
      <SectionHeading title={props.title} count={open} hint={props.hint} tone={props.tone} />
      <div className="space-y-3">
        {[...byPr.values()].map((list) => (
          <PrThreads key={list[0]?.id} threads={list} resolved={props.resolved} actions={props.actions} />
        ))}
      </div>
    </section>
  )
}

function PrThreads({
  threads,
  resolved,
  actions,
}: {
  threads: OpenThread[]
  resolved: ReadonlySet<string>
  actions: ThreadActions
}) {
  const [pr] = threads
  if (!pr) {
    return null
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-line bg-panel-2 px-4 py-2 text-left text-[12px] hover:bg-hover"
        onClick={() => actions.onOpen(pr)}
      >
        <span className="truncate font-semibold">{pr.prTitle}</span>
        {Boolean(pr.isDraft) && <span className="chip bg-panel text-muted">draft</span>}
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

function ThreadRow({
  thread: t,
  isResolved,
  actions,
}: {
  thread: OpenThread
  isResolved: boolean
  actions: ThreadActions
}) {
  const [replying, setReplying] = useState(false)
  const { busy, error, run } = useAsyncAction()
  const sendReply = async (body: string) => {
    await run(async () => {
      await actions.onReply(t.id, body)
      setReplying(false)
    })
  }
  const resolve = (value: boolean) => run(() => actions.onResolve(t.id, value))

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="group/row flex gap-3 px-4 py-2.5 hover:bg-hover">
        <ThreadSummary
          thread={t}
          dimmed={isResolved}
          onOpen={() =>
            actions.onOpen(t, {
              path: t.path,
              line: t.line,
              commentId: reviewCommentIdFromUrl(t.comments.at(-1)?.url ?? '') ?? undefined,
            })
          }
        />
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[11.5px] text-muted">{ago(t.lastActivityAt)}</span>
          <ThreadButtons
            isResolved={isResolved}
            busy={busy}
            replying={replying}
            onReply={() => setReplying(true)}
            onResolve={resolve}
          />
        </div>
      </div>
      {Boolean(replying || error) && (
        <div className="space-y-2 px-4 pb-3 pl-13">
          {Boolean(replying) && (
            <Composer
              label={`Reply to ${t.comments.at(-1)?.author ?? 'the thread'}`}
              unsentKey={`thread:${t.id}`}
              onCancel={() => setReplying(false)}
              onSubmitNow={sendReply}
            />
          )}
          {Boolean(error) && <div className="text-[12px] text-danger selectable">{error}</div>}
        </div>
      )}
    </li>
  )
}

const AVATAR_PX = 24

function summaryTitle(outdated: boolean) {
  if (outdated) {
    return 'The code this thread was on has changed since; opens the file.'
  }
  return 'Open the PR at this line'
}

/** `path:line`, or the path alone when the thread has no current line. */
function pathAndLine(t: OpenThread) {
  if (!t.line) {
    return t.path
  }
  return `${t.path}:${t.line}`
}

function ThreadSummary({ thread: t, dimmed, onOpen }: { thread: OpenThread; dimmed: boolean; onOpen: () => void }) {
  const last = t.comments.at(-1)
  if (!last) {
    return null
  }
  return (
    <button
      type="button"
      className={cx('flex min-w-0 flex-1 gap-3 text-left', dimmed && 'opacity-50')}
      onClick={onOpen}
      title={summaryTitle(t.outdated)}
    >
      <img
        src={last.authorAvatar}
        alt=""
        width={AVATAR_PX}
        height={AVATAR_PX}
        className="mt-0.5 size-6 shrink-0 rounded-full bg-panel-2"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[12px]">
          <code className="truncate" title={pathAndLine(t)}>
            {pathAndLine(t)}
          </code>
          {Boolean(t.outdated) && <span className="chip bg-panel-2 text-muted">outdated</span>}
          {Boolean(last.bot) && <span className="chip bg-panel-2 text-muted">bot</span>}
          <span className="shrink-0 text-muted">{countOf(t.totalComments, 'comment', 'comments')}</span>
        </div>
        <div className={cx('mt-0.5 line-clamp-2 text-[12.5px]', t.waitingOn === 'others' && 'text-muted')}>
          <span className="font-medium">{last.author}</span>: {summarizeComment(last.body)}
        </div>
      </div>
    </button>
  )
}

function ThreadButtons(props: {
  isResolved: boolean
  busy: boolean
  replying: boolean
  onReply: () => void
  onResolve: (resolved: boolean) => void
}) {
  if (props.isResolved) {
    return (
      <span className="flex items-center gap-1 text-[11.5px] text-ok">
        Resolved
        <button
          type="button"
          className="btn btn-ghost py-0 text-[11.5px]"
          disabled={props.busy}
          onClick={() => props.onResolve(false)}
        >
          Undo
        </button>
      </span>
    )
  }
  return (
    <span className="flex gap-1">
      <button
        type="button"
        className="btn btn-ghost py-0 text-[11.5px]"
        disabled={props.busy || props.replying}
        onClick={props.onReply}
      >
        Reply
      </button>
      <button
        type="button"
        className="btn btn-ghost py-0 text-[11.5px]"
        disabled={props.busy}
        onClick={() => props.onResolve(true)}
      >
        {Boolean(props.busy && !props.replying) && 'Resolving…'}
        {!(props.busy && !props.replying) && 'Resolve'}
      </button>
    </span>
  )
}

export interface ThreadActions {
  onOpen: OpenPull
  onReply: (threadId: string, body: string) => Promise<void>
  onResolve: (threadId: string, resolved: boolean) => Promise<void>
}

/** Unresolved review threads, split by who owes the next reply and grouped by PR. */
export const ThreadList = memo(function ThreadListView({ threads, resolved, filtering, ...actions }: Props) {
  if (threads.length === 0) {
    return (
      <EmptyState>
        {Boolean(filtering) && 'No open thread matches this search.'}
        {!filtering && 'No unresolved review threads on your open PRs. 🎉'}
      </EmptyState>
    )
  }
  return (
    <>
      <ThreadSection
        title="Waiting on your reply"
        hint="someone else spoke last"
        tone="accent"
        threads={threads.filter((t) => t.waitingOn === 'you')}
        resolved={resolved}
        actions={actions}
      />
      <ThreadSection
        title="Waiting on others"
        hint="your comment has no answer yet"
        threads={threads.filter((t) => t.waitingOn === 'others')}
        resolved={resolved}
        actions={actions}
      />
    </>
  )
})
