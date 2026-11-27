import type { PullDetail } from '@shared/pull.types.ts'
import { BriefingPanel } from './briefing-panel.component.tsx'
import { CommitsTab } from './commits-tab.component.tsx'
import { FilesTab } from './files-tab.component.tsx'
import { FindBar } from './find-bar.component.tsx'
import { OverviewTab } from './overview-tab.component.tsx'
import { PullTabBar } from './pull-tab-bar.component.tsx'
import { appendSummaryLine, markAsAi, toggleBetween } from './pull-view.util.ts'
import { QuotedComment } from './quoted-comment.component.tsx'
import { TabPane } from './tab-pane.component.tsx'
import { BLAME_STATES, PANEL_STATES, type PullViewState } from './use-pull-view.hook.ts'

/** The briefing card on the overview, wired to drafting, jumping and the review summary. */
function BriefingCard({ view, pr }: { view: PullViewState; pr: PullDetail }) {
  return (
    <BriefingPanel
      record={view.local.briefing}
      headSha={pr.headSha}
      {...view.briefing.status}
      onGenerate={view.briefing.generate}
      onJump={(path, line) => view.nav.goTo(path, line)}
      validLine={(path, line) => Boolean(view.rightLines.get(path)?.has(line))}
      patchOf={view.patchOf}
      dismissed={view.local.dismissedConcerns ?? []}
      onDismiss={view.dismissConcern}
      onRestore={view.restoreConcern}
      onDraft={(path, line, body) => {
        view.addDraft({ path, line, side: 'RIGHT', body: markAsAi(body) })
        view.nav.goTo(path, line)
      }}
      onAddToSummary={(question) => view.review.setBody((summary) => appendSummaryLine(summary, question))}
      summary={view.review.body}
    />
  )
}

type EditGuidelines = (repo: string, path?: string) => void

function OverviewPane({
  view,
  pr,
  onEditGuidelines,
}: {
  view: PullViewState
  pr: PullDetail
  onEditGuidelines: EditGuidelines
}) {
  const { quoted } = view
  return (
    <OverviewTab
      pr={pr}
      guides={view.guides}
      onEditGuidelines={onEditGuidelines}
      mentioned={
        quoted !== null && (
          <QuotedComment
            key={quoted.quote.url}
            quoted={quoted}
            onReply={(body) => globalThis.revio.commentOnPull(view.pull, body)}
            onDismiss={() => view.setQuoted(null)}
          />
        )
      }
      briefing={<BriefingCard view={view} pr={pr} />}
    />
  )
}

/** "Add to chat" for selected lines, only while a Claude chat is open. */
function addToOpenChat(view: PullViewState) {
  if (view.ask.thread === null) {
    return
  }
  return view.ask.addContext
}

function FilesPane({ view, pr }: { view: PullViewState; pr: PullDetail }) {
  return (
    <FilesTab
      files={view.orderedFiles}
      view={view.view}
      repo={view.pull.repo}
      headSha={pr.headSha}
      blame={view.blame === 'on'}
      onShowHistory={view.setHistoryPath}
      commentsByPath={view.commentsByPath}
      draftsByPath={view.draftsByPath}
      focusByPath={view.focusByPath}
      ignoreByPath={view.ignoreByPath}
      viewed={view.local.viewed}
      collapsed={view.nav.collapsed}
      current={view.nav.current}
      onSelectFile={view.nav.select}
      onToggleCollapsed={view.nav.setFileCollapsed}
      onToggleViewed={view.toggleViewed}
      onAddDraft={view.addDraft}
      onUpdateDraft={view.updateDraft}
      onDeleteDraft={view.deleteDraft}
      onReplyNow={view.replyNow}
      onAsk={view.ask.start}
      onAddToChat={addToOpenChat(view)}
    />
  )
}

/** The tab bar with its toggles, the find bar, and the overview, commits and files tabs. */
export function PullTabs({
  view,
  pr,
  onEditGuidelines,
  onOpenCommit,
}: {
  view: PullViewState
  pr: PullDetail
  onEditGuidelines: EditGuidelines
  /** A commit opened on the Commits tab, for the git log to pick. */
  onOpenCommit: (sha: string) => void
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <PullTabBar
        tab={view.tab}
        onTab={view.setTab}
        commitCount={pr.commitCount}
        openThreadCount={view.commentThreads.filter((thread) => !thread.resolved).length}
        commentsPanelOpen={view.commentsPanel === 'open'}
        onToggleCommentsPanel={() => {
          view.setHistoryPath(null)
          view.setCommentsPanel(toggleBetween(view.commentsPanel, PANEL_STATES))
        }}
        blame={view.blame === 'on'}
        onToggleBlame={() => view.setBlame(toggleBetween(view.blame, BLAME_STATES))}
        threadsFolded={view.threadFold.all}
        onToggleThreadsFolded={() => view.threadFold.setAll(!view.threadFold.all)}
        view={view.view}
        onView={view.changeView}
      />
      {Boolean(view.tab === 'files' && view.find.open) && <FindBar find={view.find} />}
      <TabPane active={view.tab === 'overview'}>
        <OverviewPane view={view} pr={pr} onEditGuidelines={onEditGuidelines} />
      </TabPane>
      <TabPane active={view.tab === 'commits'}>
        <CommitsTab pull={view.pull} headSha={pr.headSha} onOpenCommit={onOpenCommit} />
      </TabPane>
      <TabPane active={view.tab === 'files'}>
        <FilesPane view={view} pr={pr} />
      </TabPane>
    </section>
  )
}
