import type { AskThread } from '@shared/claude.types.ts'
import type { PullDetail } from '@shared/pull.types.ts'
import { useMemo } from 'react'
import { AskPanel } from './ask-panel.component.tsx'
import { CommentsPanel } from './comments-panel.component.tsx'
import { FileHistoryPanel } from './file-history-panel.component.tsx'
import { askHistory, buildDraftFromAsk, keepNewSideOnly } from './pull-view.util.ts'
import { SymbolPanel } from './symbol-panel.component.tsx'
import type { PullViewState } from './use-pull-view.hook.ts'

/** The Claude conversation about a selection, with the earlier ones to switch to. */
function AskSidePanel({ view, thread }: { view: PullViewState; thread: AskThread }) {
  const saved = view.local.asks ?? []
  const { setThread } = view.ask
  return (
    <AskPanel
      pull={view.pull}
      thread={thread}
      history={askHistory(thread, saved)}
      onSelect={(id) => setThread(saved.find((savedThread) => savedThread.id === id) ?? thread)}
      onDelete={(id) => {
        view.deleteThread(id)
        if (id === thread.id) {
          setThread(saved.find((savedThread) => savedThread.id !== id) ?? null)
        }
      }}
      onChange={(next) => {
        setThread(next)
        view.saveThread(next)
      }}
      onClose={() => setThread(null)}
      onJump={(path, line) => view.nav.goTo(path, keepNewSideOnly(thread.side, line))}
      onUseAsDraft={(askThread, body) => {
        view.addDraft(buildDraftFromAsk(askThread, body))
        view.nav.goTo(askThread.path, keepNewSideOnly(askThread.side, askThread.endLine))
      }}
    />
  )
}

/** The panel beside the diff: a Claude conversation, else a name's usages, else a file's history, else the comments. */
export function PullSidePanels({ view, pr }: { view: PullViewState; pr: PullDetail }) {
  const reviewedBy = useMemo(() => ({ viewer: pr.viewer, since: pr.lastReviewedAt }), [pr.viewer, pr.lastReviewedAt])
  const askThread = view.ask.thread
  if (askThread !== null) {
    return <AskSidePanel view={view} thread={askThread} />
  }
  if (view.tab !== 'files') {
    return null
  }
  if (view.symbolName !== null) {
    return (
      <SymbolPanel
        pull={view.pull}
        name={view.symbolName}
        onJump={(path, line) => view.nav.goTo(path, line)}
        onClose={() => view.setSymbolName(null)}
      />
    )
  }
  if (view.historyPath !== null) {
    return (
      <FileHistoryPanel
        key={view.historyPath}
        repo={view.pull.repo}
        headSha={pr.headSha}
        path={view.historyPath}
        pull={view.pull}
        onClose={() => view.setHistoryPath(null)}
      />
    )
  }
  if (view.commentsPanel !== 'open') {
    return null
  }
  return (
    <CommentsPanel
      threads={view.commentThreads}
      conversation={view.pr?.conversation ?? []}
      onOpenConversation={(comment) => {
        view.setQuoted({ quote: comment, openedFrom: 'comments-panel' })
        view.setTab('overview')
      }}
      drafts={view.local.drafts}
      current={view.nav.current}
      reviewed={reviewedBy}
      onJump={(path, line, commentId) => view.nav.goTo(path, line, true, commentId)}
      onClose={() => view.setCommentsPanel('closed')}
    />
  )
}
