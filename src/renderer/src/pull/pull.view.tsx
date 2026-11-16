import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AskThread } from '@shared/claude.types'
import type { ResolvedGuideline } from '@shared/guideline.types'
import type { Stack } from '@shared/inbox.types'
import { pullKey, type PullDetail, type PullRef, type ReviewEvent } from '@shared/pull.types'
import { BriefingPanel } from './briefing-panel.component'
import { ErrorBanner } from '../common/error-banner.component'
import { AskPanel } from './ask-panel.component'
import { DiffFile, type AskSelection, type DiffView } from './diff-file.component'
import { Markdown } from '../common/markdown.component'
import { FileTree } from './file-tree.component'
import { groupByDir, initialCollapsed, newSideLinesByPath, suggestFolders } from './files.util'
import { EMPTY, groupBy } from '../common/group.util'
import { useStoredChoice } from '../common/use-stored-choice.hook'
import type { OpenPull } from '../common/navigation.types'
import { CommentsPanel } from './comments-panel.component'
import { groupCommentThreads } from './comment-threads.util'
import { useFileKeyboardNav } from './use-file-keyboard-nav.hook'
import { usePullLocalState } from './use-pull-local-state.hook'
import { useScrollToTarget, type ScrollTarget } from './use-scroll-to-target.hook'
import { MyReviewChip, ReviewPopover } from './review-popover.component'
import { StackBar } from './stack-bar.component'
import { cx, errorMessage } from '../common/format.util'

const DIFF_VIEWS: readonly DiffView[] = ['unified', 'split']
const PANEL_STATES = ['open', 'closed'] as const

type Tab = 'overview' | 'files'

/** A prefetched copy this recent is shown immediately. */
const PREFETCH_MAX_AGE_MS = 2 * 60_000
/** Copies older than this are refreshed in the background after showing. */
const FRESH_ENOUGH_MS = 15_000

export function PullView(props: {
  pull: PullRef
  /** A file and line to open at, e.g. from a review thread in the inbox. */
  initialTarget?: ScrollTarget
  onBack: () => void
  onEditGuidelines: (repo: string, path?: string) => void
  onOpenPull: OpenPull
}) {
  const { repo, number } = props.pull
  // A stable reference for hooks; the props object may be recreated by the parent.
  const pull = useMemo(() => ({ repo, number }), [repo, number])
  const key = pullKey(pull)
  const [pr, setPr] = useState<PullDetail | null>(null)
  const [guides, setGuides] = useState<ResolvedGuideline[]>([])
  const [error, setError] = useState<string | null>(null)
  const [stack, setStack] = useState<Stack | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [briefing, setBriefing] = useState({ loading: false, progress: null as string | null, error: null as string | null })
  /** Which review action the submit popover opens with, or false when closed. */
  const [reviewOpen, setReviewOpen] = useState<ReviewEvent | false>(false)
  const [reviewBody, setReviewBody] = useState('')
  const [askThread, setAskThread] = useState<AskThread | null>(null)
  const [view, changeView] = useStoredChoice<DiffView>('revio.diffView', DIFF_VIEWS, 'unified')
  const [commentsPanel, setCommentsPanel] = useStoredChoice('revio.commentsPanel', PANEL_STATES, 'open')
  const { local, replaceLocal, addDraft, updateDraft, deleteDraft, forgetDrafts, markViewed, saveThread, setBriefingRecord } =
    usePullLocalState(pull)

  /** Shows a recent copy right away when one exists (e.g. prefetched on hover), then refreshes it. */
  const load = useCallback(
    async (maxAgeMs = 0) => {
      setError(null)
      try {
        const [p, l] = await Promise.all([window.revio.getPull(pull, maxAgeMs), window.revio.getLocalState(pull)])
        setPr(p)
        replaceLocal(l)
        setCollapsed(initialCollapsed(p, l))
        setGuides(await window.revio.resolveGuidelines(repo, p.files.map((f) => f.path)))
        if (Date.now() - new Date(p.fetchedAt).getTime() > FRESH_ENOUGH_MS) refreshInBackground()
      } catch (e) {
        setError(errorMessage(e))
      }
    },
    [pull, repo, replaceLocal],
  )

  const refreshInBackground = () => {
    window.revio
      .getPull(pull)
      .then(setPr)
      .catch(() => {})
  }

  useEffect(() => {
    window.revio
      .getStack(pull)
      .then(setStack)
      .catch(() => setStack(null))
  }, [pull])

  useEffect(() => {
    void load(PREFETCH_MAX_AGE_MS)
    return window.revio.onEvent((e) => {
      if (e.type === 'briefing-progress' && e.key === key) setBriefing((b) => ({ ...b, progress: e.message }))
    })
  }, [load, key])

  const replyNow = useCallback(
    async (commentId: number, body: string) => {
      await window.revio.replyToComment(pull, commentId, body)
      setPr(await window.revio.getPull(pull))
    },
    [pull],
  )

  // ------------------------------------------------------------ ask Claude

  const startAsk = useCallback((sel: AskSelection) => {
    setAskThread({ id: crypto.randomUUID(), ...sel, messages: [], createdAt: new Date().toISOString() })
  }, [])

  const updateThread = (thread: AskThread) => {
    setAskThread(thread)
    saveThread(thread)
  }

  // ------------------------------------------------------------ briefing

  const generateBriefing = async () => {
    setBriefing({ loading: true, progress: null, error: null })
    try {
      const record = await window.revio.generateBriefing(pull)
      setBriefingRecord(record)
      setCollapsed((c) => ({ ...c, ...Object.fromEntries(record.briefing.ignore.map((i) => [i.path, true])) }))
      setBriefing({ loading: false, progress: null, error: null })
    } catch (e) {
      setBriefing({ loading: false, progress: null, error: errorMessage(e) })
    }
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
  const openThreadCount = commentThreads.filter((t) => !t.resolved).length
  const rightLines = useMemo(() => newSideLinesByPath(pr), [pr])

  // ------------------------------------------------------------ navigation

  const [current, setCurrent] = useState<string | null>(null)
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null)
  const goTo = useCallback((path: string, line: number | null = null, expand = true) => {
    setTab('files')
    setCurrent(path)
    if (expand) setCollapsed((c) => ({ ...c, [path]: false }))
    setScrollTarget({ path, line })
  }, [])
  const clearScrollTarget = useCallback(() => setScrollTarget(null), [])
  // Jump to the requested line once, after the first load has set which files start collapsed.
  const pendingTarget = useRef(props.initialTarget)
  useEffect(() => {
    const target = pendingTarget.current
    if (!pr || !target) return
    pendingTarget.current = undefined
    goTo(target.path, target.line)
  }, [pr, goTo])
  useScrollToTarget(scrollTarget, tab === 'files', clearScrollTarget)

  const toggleCollapsed = useCallback((path: string, value: boolean) => setCollapsed((c) => ({ ...c, [path]: value })), [])
  const toggleViewed = useCallback(
    (path: string, sha: string, viewed: boolean) => {
      markViewed(path, sha, viewed)
      setCollapsed((c) => ({ ...c, [path]: viewed }))
    },
    [markViewed],
  )

  useFileKeyboardNav({
    enabled: !!pr && !reviewOpen,
    files: orderedFiles,
    current,
    viewed: local.viewed,
    goTo: (path, expand) => goTo(path, null, expand),
    markViewed: toggleViewed,
  })

  // ------------------------------------------------------------ render

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

  const folders = suggestFolders(pr.files.map((f) => f.path)).filter((p) => !guides.some((g) => g.repo === repo && g.path === p))

  return (
    <div className="flex h-full flex-col">
      <header className="drag flex shrink-0 items-center gap-3 border-b border-line px-4 py-2">
        <button className="btn btn-ghost no-drag" onClick={props.onBack}>
          ←
        </button>
        <img src={pr.authorAvatar} alt="" className="size-7 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="selectable no-drag truncate text-[14px] font-semibold">
            {pr.title} <span className="font-normal text-muted">#{pr.number}</span>
          </div>
          <div className="truncate text-[12px] text-muted">
            {pr.repo} · {pr.author} wants to merge <code className="text-fg">{pr.headRef}</code> into <code className="text-fg">{pr.baseRef}</code> ·{' '}
            <span className="text-ok">+{pr.additions}</span> <span className="text-danger">−{pr.deletions}</span>
          </div>
        </div>
        {!askThread && (local.asks?.length ?? 0) > 0 && (
          <button className="btn no-drag" onClick={() => setAskThread(local.asks![0]!)}>
            ✦ {local.asks!.length} Claude chat{local.asks!.length > 1 ? 's' : ''}
          </button>
        )}
        <button className="btn no-drag" onClick={() => void window.revio.openExternal(pr.url)}>
          GitHub ↗
        </button>
        {pr.myReview && <MyReviewChip review={pr.myReview} />}
        <div className="no-drag relative flex gap-2">
          {pr.author !== pr.viewer && !(pr.myReview?.state === 'APPROVED' && !pr.myReview.stale) && (
            <button
              className="btn border-ok/50 text-ok hover:bg-ok/10"
              onClick={() => setReviewOpen(reviewOpen === 'APPROVE' ? false : 'APPROVE')}
              title="Approve this pull request"
            >
              ✓ {pr.myReview?.state === 'APPROVED' ? 'Re-approve' : 'Approve'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setReviewOpen(reviewOpen ? false : 'COMMENT')}>
            Finish review{local.drafts.length ? ` (${local.drafts.length})` : ''}
          </button>
          {reviewOpen && (
            <ReviewPopover
              key={reviewOpen}
              initialEvent={reviewOpen}
              isAuthor={pr.author === pr.viewer}
              body={reviewBody}
              setBody={setReviewBody}
              draftCount={local.drafts.length}
              onClose={() => setReviewOpen(false)}
              onSubmit={async (event) => {
                const res = await window.revio.submitReview({ repo, number, headSha: pr.headSha, event, body: reviewBody })
                setReviewBody('')
                setReviewOpen(false)
                forgetDrafts()
                await load()
                return res.url
              }}
            />
          )}
        </div>
      </header>

      {stack && <StackBar stack={stack} pull={pull} onOpen={props.onOpenPull} />}

      <div className="flex min-h-0 flex-1">
        <FileTree
          files={pr.files}
          viewed={local.viewed}
          current={current}
          focusPaths={focusPaths}
          ignorePaths={ignorePaths}
          draftCounts={draftCounts}
          onSelect={goTo}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 gap-1 border-b border-line px-4 pt-2">
            {(['overview', 'files'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cx('-mb-px border-b-2 px-3 py-1.5 font-medium', tab === t ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg')}
              >
                {t === 'overview' ? 'Overview' : `Files changed`}
              </button>
            ))}
            {tab === 'files' && (
              <button
                className={cx('mb-1.5 ml-auto self-center rounded px-2 py-0.5 text-[12px]', commentsPanel === 'open' ? 'bg-hover text-fg' : 'text-muted hover:text-fg')}
                title={commentsPanel === 'open' ? 'Hide the comments panel' : 'Show every comment thread in a panel'}
                onClick={() => setCommentsPanel(commentsPanel === 'open' ? 'closed' : 'open')}
              >
                💬 {openThreadCount}
              </button>
            )}
            {tab === 'files' && (
              <span className="mb-1.5 ml-3 self-center text-[11.5px] text-muted">
                <kbd className="kbd">j</kbd>/<kbd className="kbd">k</kbd> files · <kbd className="kbd">v</kbd> viewed
              </span>
            )}
            {tab === 'files' && (
              <div className="mb-1.5 ml-3 flex rounded-md border border-line p-0.5">
                {(['unified', 'split'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => changeView(v)}
                    className={cx('rounded px-2.5 py-0.5 text-[12px] capitalize', view === v ? 'bg-hover text-fg' : 'text-muted hover:text-fg')}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div data-scroll-root className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {tab === 'overview' && (
              <div className="mx-auto max-w-4xl space-y-6 px-6 py-5">
                <BriefingPanel
                  record={local.briefing}
                  headSha={pr.headSha}
                  {...briefing}
                  onGenerate={generateBriefing}
                  onJump={(path, line) => goTo(path, line)}
                  validLine={(path, line) => !!rightLines.get(path)?.has(line)}
                  onDraft={(path, line, body) => {
                    addDraft({ path, line, side: 'RIGHT', body })
                    goTo(path, line)
                  }}
                  onAddToSummary={(q) => setReviewBody((b) => `${b}${b ? '\n' : ''}- ${q}`)}
                />

                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
                    Your guides for this PR
                    <button className="btn btn-ghost py-0 font-normal normal-case" onClick={() => props.onEditGuidelines(repo)}>
                      Edit
                    </button>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {guides.map((g) => (
                      <button key={g.id} className="btn" title={g.body} onClick={() => props.onEditGuidelines(g.repo === '*' ? '*' : g.repo, g.path)}>
                        <span className="font-mono text-muted">{g.repo === '*' ? '*' : g.path || '/'}</span> {g.title}
                        {g.path && <span className="text-muted">· {g.matchedFiles} files</span>}
                      </button>
                    ))}
                    {folders.slice(0, 4).map((p) => (
                      <button key={p} className="btn btn-ghost border-dashed border-line text-muted" onClick={() => props.onEditGuidelines(repo, p)}>
                        + guide for <span className="font-mono">{p}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">Description</h3>
                  <div className="rounded-lg border border-line bg-panel px-5 py-4">
                    <Markdown>{pr.body || '_No description provided._'}</Markdown>
                  </div>
                </section>
              </div>
            )}

            {tab === 'files' && (
              <div className="space-y-3 p-4">
                {orderedFiles.map((f) => (
                  <DiffFile
                    key={f.path}
                    file={f}
                    view={view}
                    comments={commentsByPath.get(f.path) ?? EMPTY}
                    drafts={draftsByPath.get(f.path) ?? EMPTY}
                    focus={focusByPath.get(f.path) ?? EMPTY}
                    ignoreReason={ignoreByPath.get(f.path)}
                    viewed={local.viewed[f.path] === f.sha}
                    collapsed={!!collapsed[f.path]}
                    current={current === f.path}
                    onToggleCollapsed={toggleCollapsed}
                    onToggleViewed={toggleViewed}
                    onAddDraft={addDraft}
                    onUpdateDraft={updateDraft}
                    onDeleteDraft={deleteDraft}
                    onReplyNow={replyNow}
                    onAsk={startAsk}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {tab === 'files' && commentsPanel === 'open' && !askThread && (
          <CommentsPanel threads={commentThreads} drafts={local.drafts} current={current} onJump={goTo} onClose={() => setCommentsPanel('closed')} />
        )}

        {askThread && (
          <AskPanel
            pull={pull}
            thread={askThread}
            history={[...(askThread.messages.length ? [] : [askThread]), ...(local.asks ?? [])]}
            onSelect={(id) => setAskThread((local.asks ?? []).find((t) => t.id === id) ?? askThread)}
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
  )
}

