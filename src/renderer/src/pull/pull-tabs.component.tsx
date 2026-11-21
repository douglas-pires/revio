import type { PullDetail } from '@shared/pull.types.ts'
import { BriefingPanel } from './briefing-panel.component.tsx'
import { CommitsTab } from './commits-tab.component.tsx'
import { FilesTab } from './files-tab.component.tsx'
import { FindBar } from './find-bar.component.tsx'
import { OverviewTab } from './overview-tab.component.tsx'
import { PullTabBar } from './pull-tab-bar.component.tsx'
import { markedAsAi, toggled, withSummaryLine } from './pull-view.util.ts'
import { QuotedComment } from './quoted-comment.component.tsx'
import { TabPane } from './tab-pane.component.tsx'
import { BLAME_STATES, PANEL_STATES, type PullViewState } from './use-pull-view.hook.ts'

/** The briefing card on the overview, wired to drafting, jumping and the review summary. */
function BriefingCard({ v, pr }: { v: PullViewState; pr: PullDetail }) {
  return (
    <BriefingPanel
      record={v.local.briefing}
      headSha={pr.headSha}
      {...v.briefing.status}
      onGenerate={v.briefing.generate}
      onJump={(path, line) => v.nav.goTo(path, line)}
      validLine={(path, line) => Boolean(v.rightLines.get(path)?.has(line))}
      patchOf={v.patchOf}
      onDraft={(path, line, body) => {
        v.addDraft({ path, line, side: 'RIGHT', body: markedAsAi(body) })
        v.nav.goTo(path, line)
      }}
      onAddToSummary={(q) => v.review.setBody((b) => withSummaryLine(b, q))}
    />
  )
}

type EditGuidelines = (repo: string, path?: string) => void

function OverviewPane({
  v,
  pr,
  onEditGuidelines,
}: {
  v: PullViewState
  pr: PullDetail
  onEditGuidelines: EditGuidelines
}) {
  const { quoted } = v
  return (
    <OverviewTab
      pr={pr}
      guides={v.guides}
      onEditGuidelines={onEditGuidelines}
      mentioned={
        quoted !== null && (
          <QuotedComment
            key={quoted.quote.url}
            quoted={quoted}
            onReply={(body) => globalThis.revio.commentOnPull(v.pull, body)}
            onDismiss={() => v.setQuoted(null)}
          />
        )
      }
      briefing={<BriefingCard v={v} pr={pr} />}
    />
  )
}

/** "Add to chat" for selected lines, only while a Claude chat is open. */
function addToOpenChat(v: PullViewState) {
  if (v.ask.thread === null) {
    return
  }
  return v.ask.addContext
}

function FilesPane({ v, pr }: { v: PullViewState; pr: PullDetail }) {
  return (
    <FilesTab
      files={v.orderedFiles}
      view={v.view}
      repo={v.pull.repo}
      headSha={pr.headSha}
      blame={v.blame === 'on'}
      onShowHistory={v.setHistoryPath}
      commentsByPath={v.commentsByPath}
      draftsByPath={v.draftsByPath}
      focusByPath={v.focusByPath}
      ignoreByPath={v.ignoreByPath}
      viewed={v.local.viewed}
      collapsed={v.nav.collapsed}
      current={v.nav.current}
      onSelectFile={v.nav.select}
      onToggleCollapsed={v.nav.setFileCollapsed}
      onToggleViewed={v.toggleViewed}
      onAddDraft={v.addDraft}
      onUpdateDraft={v.updateDraft}
      onDeleteDraft={v.deleteDraft}
      onReplyNow={v.replyNow}
      onAsk={v.ask.start}
      onAddToChat={addToOpenChat(v)}
    />
  )
}

/** The tab bar with its toggles, the find bar, and the overview, commits and files tabs. */
export function PullTabs({
  v,
  pr,
  onEditGuidelines,
}: {
  v: PullViewState
  pr: PullDetail
  onEditGuidelines: EditGuidelines
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <PullTabBar
        tab={v.tab}
        onTab={v.setTab}
        commitCount={pr.commitCount}
        openThreadCount={v.commentThreads.filter((t) => !t.resolved).length}
        commentsPanelOpen={v.commentsPanel === 'open'}
        onToggleCommentsPanel={() => {
          v.setHistoryPath(null)
          v.setCommentsPanel(toggled(v.commentsPanel, PANEL_STATES))
        }}
        blame={v.blame === 'on'}
        onToggleBlame={() => v.setBlame(toggled(v.blame, BLAME_STATES))}
        threadsFolded={v.threadFold.all}
        onToggleThreadsFolded={() => v.threadFold.setAll(!v.threadFold.all)}
        view={v.view}
        onView={v.changeView}
      />
      {Boolean(v.tab === 'files' && v.find.open) && <FindBar find={v.find} />}
      <TabPane active={v.tab === 'overview'}>
        <OverviewPane v={v} pr={pr} onEditGuidelines={onEditGuidelines} />
      </TabPane>
      <TabPane active={v.tab === 'commits'}>
        <CommitsTab pull={v.pull} headSha={pr.headSha} />
      </TabPane>
      <TabPane active={v.tab === 'files'}>
        <FilesPane v={v} pr={pr} />
      </TabPane>
    </section>
  )
}
