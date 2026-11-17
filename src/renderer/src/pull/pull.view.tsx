import { useCallback, useMemo, useState } from 'react'
import type { AskThread } from '@shared/claude.types'
import type { PullRef, ReviewEvent } from '@shared/pull.types'
import { BriefingPanel } from './briefing-panel.component'
import { ErrorBanner } from '../common/error-banner.component'
import { AskPanel } from './ask-panel.component'
import type { AskSelection, DiffView } from './diff-file.component'
import { FileTree } from './file-tree.component'
import { groupByDir, initialCollapsed, newSideLinesByPath } from './files.util'
import { groupBy } from '../common/group.util'
import { useStoredChoice } from '../common/use-stored-choice.hook'
import { isConversationTarget, type ConversationQuote, type OpenPull, type PullTarget } from '../common/navigation.types'
import { CommentsPanel } from './comments-panel.component'
import { groupCommentThreads } from './comment-threads.util'
import { useFileKeyboardNav } from './use-file-keyboard-nav.hook'
import { usePullLocalState } from './use-pull-local-state.hook'
import { usePullDetail } from './use-pull-detail.hook'
import { useBriefing } from './use-briefing.hook'
import { useFileNavigation } from './use-file-navigation.hook'
import { StackBar } from './stack-bar.component'
import { PullHeader } from './pull-header.component'
import { PullTabBar, type PullTab } from './pull-tab-bar.component'
import { OverviewTab } from './overview-tab.component'
import { FilesTab } from './files-tab.component'
import { MentionedComment } from './mentioned-comment.component'
import { ReactionsContext, type SetReaction } from './use-reactions.hook'

const DIFF_VIEWS: readonly DiffView[] = ['unified', 'split']
const PANEL_STATES = ['open', 'closed'] as const

export function PullView(props: {
  pull: PullRef
  /** Where to open: a file, line or comment (e.g. from a review thread or a mention), or a conversation comment. */
  initialTarget?: PullTarget
  onBack: () => void
  onEditGuidelines: (repo: string, path?: string) => void
  onOpenPull: OpenPull
}) {
  const { repo, number } = props.pull
  // A stable reference for hooks; the props object may be recreated by the parent.
  const pull = useMemo(() => ({ repo, number }), [repo, number])
  const [tab, setTab] = useState<PullTab>('overview')
  const [reviewOpen, setReviewOpen] = useState<ReviewEvent | false>(false)
  const [reviewBody, setReviewBody] = useState('')
  const [askThread, setAskThread] = useState<AskThread | null>(null)
  const [quote, setQuote] = useState<ConversationQuote | null>(() => (props.initialTarget && isConversationTarget(props.initialTarget) ? props.initialTarget.conversation : null))
  const fileTarget = props.initialTarget && !isConversationTarget(props.initialTarget) ? props.initialTarget : undefined
  const [view, changeView] = useStoredChoice<DiffView>('revio.diffView', DIFF_VIEWS, 'unified')
  const [commentsPanel, setCommentsPanel] = useStoredChoice('revio.commentsPanel', PANEL_STATES, 'open')
  const { local, replaceLocal, addDraft, updateDraft, deleteDraft, forgetDrafts, markViewed, saveThread, setBriefingRecord } = usePullLocalState(pull)

  const showFiles = useCallback(() => setTab('files'), [])
  // The callback runs after an await, by which time `nav` below is defined.
  const { pr, guides, error, stack, reload, replyNow } = usePullDetail(pull, (p, l) => {
    replaceLocal(l)
    nav.replaceCollapsed(initialCollapsed(p, l))
  })
  const nav = useFileNavigation({ pr, onFilesTab: tab === 'files', showFiles, initialTarget: fileTarget })
  const { goTo } = nav
  const briefing = useBriefing(pull, (record) => {
    setBriefingRecord(record)
    nav.collapseFiles(record.briefing.ignore.map((i) => i.path))
  })

  const setReaction: SetReaction = useCallback((subjectId, content, on) => window.revio.setReaction(pull, subjectId, content, on), [pull])

  const startAsk = useCallback((sel: AskSelection) => {
    setAskThread({ id: crypto.randomUUID(), ...sel, messages: [], createdAt: new Date().toISOString() })
  }, [])
  const updateThread = (thread: AskThread) => {
    setAskThread(thread)
    saveThread(thread)
  }

  const focusByPath = useMemo(() => groupBy(local.briefing?.briefing.focus ?? [], (f) => f.path), [local.briefing])
  const ignoreByPath = useMemo(() => new Map(local.briefing?.briefing.ignore.map((i) => [i.path, i.reason])), [local.briefing])
  const focusPaths = useMemo(() => new Set(focusByPath.keys()), [focusByPath])
  const ignorePaths = useMemo(() => new Set(ignoreByPath.keys()), [ignoreByPath])
  const draftsByPath = useMemo(() => groupBy(local.drafts, (d) => d.path), [local.drafts])
  const draftCounts = useMemo(() => new Map([...draftsByPath].map(([path, ds]) => [path, ds.length])), [draftsByPath])
  const commentsByPath = useMemo(() => groupBy(pr?.comments ?? [], (c) => c.path), [pr])

  /** Folder-grouped order, shared by the sidebar, the diff list and j/k. */
  const orderedFiles = useMemo(() => (pr ? groupByDir(pr.files).flatMap(([, fs]) => fs) : []), [pr])
  const commentThreads = useMemo(() => groupCommentThreads(pr?.comments ?? [], pr?.threads ?? [], orderedFiles.map((f) => f.path)), [pr, orderedFiles])
  const rightLines = useMemo(() => newSideLinesByPath(pr), [pr])
  const patchOf = useCallback((path: string) => pr?.files.find((f) => f.path === path)?.patch, [pr])

  const toggleViewed = useCallback(
    (path: string, sha: string, viewed: boolean) => {
      markViewed(path, sha, viewed)
      nav.setFileCollapsed(path, viewed)
    },
    [markViewed, nav.setFileCollapsed],
  )

  useFileKeyboardNav({
    enabled: !!pr && !reviewOpen,
    files: orderedFiles,
    current: nav.current,
    viewed: local.viewed,
    goTo: (path, expand) => goTo(path, null, expand),
    markViewed: toggleViewed,
  })

  if (error)
    return (
      <div className="p-6">
        <button className="btn mb-4" onClick={props.onBack}>
          ← Inbox
        </button>
        <ErrorBanner>{error}</ErrorBanner>
      </div>
    )
  if (!pr) return <div className="flex h-full items-center justify-center text-muted">Loading {repo}#{number}…</div>

  const asks = local.asks ?? []

  return (
    <ReactionsContext value={setReaction}>
    <div className="flex h-full flex-col">
      <PullHeader
        pr={pr}
        draftCount={local.drafts.length}
        askCount={askThread ? 0 : asks.length}
        onOpenAsks={() => setAskThread(asks[0]!)}
        onBack={props.onBack}
        reviewOpen={reviewOpen}
        setReviewOpen={setReviewOpen}
        reviewBody={reviewBody}
        setReviewBody={setReviewBody}
        onSubmitReview={async (event) => {
          const res = await window.revio.submitReview({ repo, number, headSha: pr.headSha, event, body: reviewBody })
          setReviewBody('')
          setReviewOpen(false)
          forgetDrafts()
          await reload()
          return res.url
        }}
      />

      {stack && <StackBar stack={stack} pull={pull} onOpen={props.onOpenPull} />}

      <div className="flex min-h-0 flex-1">
        <FileTree files={pr.files} viewed={local.viewed} current={nav.current} focusPaths={focusPaths} ignorePaths={ignorePaths} draftCounts={draftCounts} onSelect={goTo} />

        <section className="flex min-w-0 flex-1 flex-col">
          <PullTabBar
            tab={tab}
            onTab={setTab}
            openThreadCount={commentThreads.filter((t) => !t.resolved).length}
            commentsPanelOpen={commentsPanel === 'open'}
            onToggleCommentsPanel={() => setCommentsPanel(commentsPanel === 'open' ? 'closed' : 'open')}
            view={view}
            onView={changeView}
          />

          <div data-scroll-root className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {tab === 'overview' && (
              <OverviewTab
                pr={pr}
                guides={guides}
                onEditGuidelines={props.onEditGuidelines}
                mentioned={quote && <MentionedComment quote={quote} onDismiss={() => setQuote(null)} />}
                briefing={
                  <BriefingPanel
                    record={local.briefing}
                    headSha={pr.headSha}
                    {...briefing.status}
                    onGenerate={briefing.generate}
                    onJump={(path, line) => goTo(path, line)}
                    validLine={(path, line) => !!rightLines.get(path)?.has(line)}
                    patchOf={patchOf}
                    onDraft={(path, line, body) => {
                      addDraft({ path, line, side: 'RIGHT', body })
                      goTo(path, line)
                    }}
                    onAddToSummary={(q) => setReviewBody((b) => `${b}${b ? '\n' : ''}- ${q}`)}
                  />
                }
              />
            )}

            {tab === 'files' && (
              <FilesTab
                files={orderedFiles}
                view={view}
                commentsByPath={commentsByPath}
                draftsByPath={draftsByPath}
                focusByPath={focusByPath}
                ignoreByPath={ignoreByPath}
                viewed={local.viewed}
                collapsed={nav.collapsed}
                current={nav.current}
                onToggleCollapsed={nav.setFileCollapsed}
                onToggleViewed={toggleViewed}
                onAddDraft={addDraft}
                onUpdateDraft={updateDraft}
                onDeleteDraft={deleteDraft}
                onReplyNow={replyNow}
                onAsk={startAsk}
              />
            )}
          </div>
        </section>

        {tab === 'files' && commentsPanel === 'open' && !askThread && (
          <CommentsPanel threads={commentThreads} drafts={local.drafts} current={nav.current} onJump={goTo} onClose={() => setCommentsPanel('closed')} />
        )}

        {askThread && (
          <AskPanel
            pull={pull}
            thread={askThread}
            history={[...(askThread.messages.length ? [] : [askThread]), ...asks]}
            onSelect={(id) => setAskThread(asks.find((t) => t.id === id) ?? askThread)}
            onChange={updateThread}
            onClose={() => setAskThread(null)}
            onJump={(path, line) => goTo(path, askThread.side === 'RIGHT' ? line : null)}
            onUseAsDraft={(t, body) => {
              addDraft({ path: t.path, side: t.side, line: t.endLine, startLine: t.startLine !== t.endLine ? t.startLine : undefined, body })
              goTo(t.path, t.side === 'RIGHT' ? t.endLine : null)
            }}
          />
        )}
      </div>
    </div>
    </ReactionsContext>
  )
}
