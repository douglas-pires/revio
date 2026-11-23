import { summarizeComment } from '@shared/excerpt.util.ts'
import { reviewCommentIdFromUrl } from '@shared/github-url.util.ts'
import type { OpenThread } from '@shared/thread.types.ts'
import { memo, useState } from 'react'
import { CopyButton } from '../common/copy-button.component.tsx'
import { EmptyState } from '../common/empty-state.component.tsx'
import { countOf, formatAge, joinClassNames } from '../common/format.util.ts'
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
  const open = props.threads.filter((thread) => !props.resolved.has(thread.id)).length
  const byPr = groupBy(props.threads, (thread) => `${thread.repo}#${thread.number}`)
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
        {threads.map((thread) => (
          <ThreadRow key={thread.id} thread={thread} isResolved={resolved.has(thread.id)} actions={actions} />
        ))}
      </ul>
    </div>
  )
}

function ThreadRow({
  thread,
  isResolved,
  actions,
}: {
  thread: OpenThread
  isResolved: boolean
  actions: ThreadActions
}) {
  const latestComment = thread.comments.at(-1)
  const [replying, setReplying] = useState(false)
  const { busy, error, run } = useAsyncAction()
  const sendReply = async (body: string) => {
    await run(async () => {
      await actions.onReply(thread.id, body)
      setReplying(false)
    })
  }
  const resolve = (value: boolean) => run(() => actions.onResolve(thread.id, value))

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="group/row flex gap-3 px-4 py-2.5 hover:bg-hover">
        <ThreadSummary
          thread={thread}
          dimmed={isResolved}
          onOpen={() =>
            actions.onOpen(thread, {
              path: thread.path,
              line: thread.line,
              commentId: reviewCommentIdFromUrl(latestComment?.url ?? '') ?? undefined,
            })
          }
        />
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-baseline gap-2">
            <CopyLatestCommentLinkButton url={latestComment?.url} />
            <span className="font-mono text-[11.5px] text-muted">{formatAge(thread.lastActivityAt)}</span>
          </span>
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
              label={`Reply to ${latestComment?.author ?? 'the thread'}`}
              unsentKey={`thread:${thread.id}`}
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

function describeSummary(outdated: boolean) {
  if (outdated) {
    return 'The code this thread was on has changed since; opens the file.'
  }
  return 'Open the PR at this line'
}

/** `path:line`, or the path alone when the thread has no current line. */
function formatPathAndLine(thread: OpenThread) {
  if (!thread.line) {
    return thread.path
  }
  return `${thread.path}:${thread.line}`
}

function ThreadSummary({ thread, dimmed, onOpen }: { thread: OpenThread; dimmed: boolean; onOpen: () => void }) {
  const last = thread.comments.at(-1)
  if (!last) {
    return null
  }
  return (
    <button
      type="button"
      className={joinClassNames('flex min-w-0 flex-1 gap-3 text-left', dimmed && 'opacity-50')}
      onClick={onOpen}
      title={describeSummary(thread.outdated)}
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
          <code className="truncate" title={formatPathAndLine(thread)}>
            {formatPathAndLine(thread)}
          </code>
          {Boolean(thread.outdated) && <span className="chip bg-panel-2 text-muted">outdated</span>}
          {Boolean(last.bot) && <span className="chip bg-panel-2 text-muted">bot</span>}
          <span className="shrink-0 text-muted">{countOf(thread.totalComments, 'comment', 'comments')}</span>
        </div>
        <div
          className={joinClassNames('mt-0.5 line-clamp-2 text-[12.5px]', thread.waitingOn === 'others' && 'text-muted')}
        >
          <span className="font-medium">{last.author}</span>: {summarizeComment(last.body)}
        </div>
      </div>
    </button>
  )
}

/** Copies the GitHub link of the thread's latest comment; shows on hover. */
function CopyLatestCommentLinkButton({ url }: { url: string | undefined }) {
  if (!url) {
    return null
  }
  return (
    <CopyButton
      text={url}
      title="Copy the latest comment's GitHub link"
      className="text-[11px] text-muted opacity-0 hover:text-fg focus-visible:opacity-100 group-hover/row:opacity-100"
    >
      Copy link
    </CopyButton>
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

interface ThreadActions {
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
        threads={threads.filter((thread) => thread.waitingOn === 'you')}
        resolved={resolved}
        actions={actions}
      />
      <ThreadSection
        title="Waiting on others"
        hint="your comment has no answer yet"
        threads={threads.filter((thread) => thread.waitingOn === 'others')}
        resolved={resolved}
        actions={actions}
      />
    </>
  )
})
