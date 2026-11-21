import type { AskThread } from '@shared/claude.types.ts'
import type { PullDetail } from '@shared/pull.types.ts'
import { useMemo } from 'react'
import { AskPanel } from './ask-panel.component.tsx'
import { CommentsPanel } from './comments-panel.component.tsx'
import { FileHistoryPanel } from './file-history-panel.component.tsx'
import { askHistory, draftFromAsk, newSideOnly } from './pull-view.util.ts'
import type { PullViewState } from './use-pull-view.hook.ts'

/** The Claude conversation about a selection, with the earlier ones to switch to. */
function AskSidePanel({ v, thread }: { v: PullViewState; thread: AskThread }) {
  const saved = v.local.asks ?? []
  const { setThread } = v.ask
  return (
    <AskPanel
      pull={v.pull}
      thread={thread}
      history={askHistory(thread, saved)}
      onSelect={(id) => setThread(saved.find((t) => t.id === id) ?? thread)}
      onDelete={(id) => {
        v.deleteThread(id)
        if (id === thread.id) {
          setThread(saved.find((t) => t.id !== id) ?? null)
        }
      }}
      onChange={(next) => {
        setThread(next)
        v.saveThread(next)
      }}
      onClose={() => setThread(null)}
      onJump={(path, line) => v.nav.goTo(path, newSideOnly(thread.side, line))}
      onUseAsDraft={(t, body) => {
        v.addDraft(draftFromAsk(t, body))
        v.nav.goTo(t.path, newSideOnly(t.side, t.endLine))
      }}
    />
  )
}

/** The panel beside the diff: a Claude conversation, else a file's history, else the comments list. */
export function PullSidePanels({ v, pr }: { v: PullViewState; pr: PullDetail }) {
  const reviewedBy = useMemo(() => ({ viewer: pr.viewer, since: pr.lastReviewedAt }), [pr.viewer, pr.lastReviewedAt])
  const askThread = v.ask.thread
  if (askThread !== null) {
    return <AskSidePanel v={v} thread={askThread} />
  }
  if (v.tab !== 'files') {
    return null
  }
  if (v.historyPath !== null) {
    return (
      <FileHistoryPanel
        key={v.historyPath}
        repo={v.pull.repo}
        headSha={pr.headSha}
        path={v.historyPath}
        pull={v.pull}
        onClose={() => v.setHistoryPath(null)}
      />
    )
  }
  if (v.commentsPanel !== 'open') {
    return null
  }
  return (
    <CommentsPanel
      threads={v.commentThreads}
      conversation={v.pr?.conversation ?? []}
      onOpenConversation={(comment) => {
        v.setQuoted({ quote: comment, openedFrom: 'comments-panel' })
        v.setTab('overview')
      }}
      drafts={v.local.drafts}
      current={v.nav.current}
      reviewed={reviewedBy}
      onJump={(path, line, commentId) => v.nav.goTo(path, line, true, commentId)}
      onClose={() => v.setCommentsPanel('closed')}
    />
  )
}
