import type { AskThread } from '@shared/claude.types.ts'
import type { PullRef, ReviewEvent } from '@shared/pull.types.ts'
import { useCallback, useMemo, useState } from 'react'
import { groupBy } from '../common/group.util.ts'
import type { PullTarget } from '../common/navigation.types.ts'
import { useStoredChoice } from '../common/use-stored-choice.hook.ts'
import { groupCommentThreads } from './comment-threads.util.ts'
import type { AskSelection, DiffView } from './diff-file.component.tsx'
import { groupByDir, initialCollapsed, newSideLinesByPath } from './files.util.ts'
import type { PullTab } from './pull-tabs.util.ts'
import { fileTargetOf, quoteOf, replyIdOf } from './pull-view.util.ts'
import { rememberStackTab, stackTabFor } from './stack-memory.util.ts'

import { useBriefing } from './use-briefing.hook.ts'

import { useDiffFind } from './use-diff-find.hook.ts'

import { useFileKeyboardNav } from './use-file-keyboard-nav.hook.ts'

import { useFileNavigation } from './use-file-navigation.hook.ts'

import { usePullDetail } from './use-pull-detail.hook.ts'

import { type PullLocalStateApi, usePullLocalState } from './use-pull-local-state.hook.ts'

import type { SetReaction } from './use-reactions.hook.ts'
import { useThreadFoldState } from './use-thread-fold.hook.ts'

const DIFF_VIEWS: readonly DiffView[] = ['unified', 'split']

/** Lookups over the PR and its local state that several parts of the view share. */
function usePullIndexes(pr: ReturnType<typeof usePullDetail>['pr'], local: PullLocalStateApi['local']) {
  const focusByPath = useMemo(() => groupBy(local.briefing?.briefing.focus ?? [], (f) => f.path), [local.briefing])
  const ignoreByPath = useMemo(
    () => new Map(local.briefing?.briefing.ignore.map((i) => [i.path, i.reason])),
    [local.briefing],
  )
  const draftsByPath = useMemo(() => groupBy(local.drafts, (d) => d.path), [local.drafts])
  /** Folder-grouped order, shared by the sidebar, the diff list and j/k. */
  const orderedFiles = useMemo(() => groupByDir(pr?.files ?? []).flatMap(([, fs]) => fs), [pr])
  return {
    focusByPath,
    ignoreByPath,
    focusPaths: useMemo(() => new Set(focusByPath.keys()), [focusByPath]),
    ignorePaths: useMemo(() => new Set(ignoreByPath.keys()), [ignoreByPath]),
    draftsByPath,
    draftCounts: useMemo(() => new Map([...draftsByPath].map(([path, ds]) => [path, ds.length])), [draftsByPath]),
    commentsByPath: useMemo(() => groupBy(pr?.comments ?? [], (c) => c.path), [pr]),
    orderedFiles,
    commentThreads: useMemo(
      () =>
        groupCommentThreads(
          pr?.comments ?? [],
          pr?.threads ?? [],
          orderedFiles.map((f) => f.path),
        ),
      [pr, orderedFiles],
    ),
    rightLines: useMemo(() => newSideLinesByPath(pr), [pr]),
    patchOf: useCallback((path: string) => pr?.files.find((f) => f.path === path)?.patch, [pr]),
  }
}

/** Which tab, which side panel and which display choices the PR view shows. */
function useViewChoices(pull: PullRef) {
  const [tab, showTab] = useState<PullTab>(() => stackTabFor(pull) ?? 'overview')
  /** Moving to another PR of the same stack opens it on this tab. */
  const setTab = useCallback(
    (next: PullTab) => {
      rememberStackTab(pull, next)
      showTab(next)
    },
    [pull],
  )
  const [view, changeView] = useStoredChoice<DiffView>('revio.diffView', DIFF_VIEWS, 'unified')
  const [commentsPanel, setCommentsPanel] = useStoredChoice('revio.commentsPanel', PANEL_STATES, 'open')
  const [blame, setBlame] = useStoredChoice('revio.blame', BLAME_STATES, 'off')
  /** The file whose history is open in the side panel. */
  const [historyPath, setHistoryPath] = useState<string | null>(null)
  const showFiles = useCallback(() => setTab('files'), [setTab])
  return {
    tab,
    setTab,
    showFiles,
    view,
    changeView,
    commentsPanel,
    setCommentsPanel,
    blame,
    setBlame,
    historyPath,
    setHistoryPath,
  }
}

/** The review being written: whether its popover is open (with the event picked) and the summary text. */
function useReviewState() {
  const [open, setOpen] = useState<ReviewEvent | false>(false)
  const [body, setBody] = useState('')
  return { open, setOpen, body, setBody }
}

/** The Claude conversation open in the side panel; `start` begins one about a selection. */
function useAskState() {
  const [thread, setThread] = useState<AskThread | null>(null)
  const start = useCallback((sel: AskSelection) => {
    setThread({ id: crypto.randomUUID(), ...sel, messages: [], createdAt: new Date().toISOString() })
  }, [])
  /** Adds lines to the open chat, for the next question. */
  const addContext = useCallback((sel: AskSelection) => {
    setThread((t) => t && { ...t, pendingContext: [...(t.pendingContext ?? []), sel] })
  }, [])
  return { thread, setThread, start, addContext }
}

/** Where the PR opened: a conversation comment to quote, a place in the diff, and a reply box to open once. */
function useArrival(initialTarget: PullTarget | undefined) {
  const [quote, setQuote] = useState(() => quoteOf(initialTarget))
  const fileTarget = fileTargetOf(initialTarget)
  const [replyToId, setReplyToId] = useState(() => replyIdOf(fileTarget))
  const replyTarget = useMemo(() => ({ commentId: replyToId, consume: () => setReplyToId(null) }), [replyToId])
  return { quote, setQuote, fileTarget, replyTarget }
}

/** The PR as a stable reference for hooks; the props object may be recreated by the parent. */
function useStablePull({ repo, number }: PullRef) {
  return useMemo(() => ({ repo, number }), [repo, number])
}

/** Marks a file viewed (or not) and collapses (or opens) it to match. */
function useViewedToggle(
  markViewed: (path: string, sha: string, viewed: boolean) => void,
  setFileCollapsed: (path: string, collapsed: boolean) => void,
) {
  return useCallback(
    (path: string, sha: string, viewed: boolean) => {
      markViewed(path, sha, viewed)
      setFileCollapsed(path, viewed)
    },
    [markViewed, setFileCollapsed],
  )
}

/** Sets your reaction on a comment of this PR. */
function useReactionSetter(pull: PullRef): SetReaction {
  return useCallback((subjectId, content, on) => globalThis.revio.setReaction(pull, subjectId, content, on), [pull])
}

export const PANEL_STATES = ['open', 'closed'] as const

export const BLAME_STATES = ['off', 'on'] as const

/**
 * Everything the PR view holds: the PR and your local review state, navigation between files, the open panels,
 * the review being written, and the Claude conversation in progress.
 */
export function usePullView(pullRef: PullRef, initialTarget: PullTarget | undefined) {
  const pull = useStablePull(pullRef)
  const choices = useViewChoices(pull)
  const review = useReviewState()
  const ask = useAskState()
  const arrival = useArrival(initialTarget)
  const local = usePullLocalState(pull)
  const onFilesTab = choices.tab === 'files'

  // The callback runs after an await, by which time `nav` below is defined.
  const detail = usePullDetail(pull, (p, l) => {
    local.replaceLocal(l)
    nav.replaceCollapsed(initialCollapsed(p, l))
  })
  const threadFold = useThreadFoldState()
  const nav = useFileNavigation({
    pr: detail.pr,
    onFilesTab,
    showFiles: choices.showFiles,
    initialTarget: arrival.fileTarget,
    onRevealComment: threadFold.reveal,
  })
  const briefing = useBriefing(pull, (record) => {
    local.setBriefingRecord(record)
    nav.collapseFiles(record.briefing.ignore.map((i) => i.path))
  })
  const indexes = usePullIndexes(detail.pr, local.local)
  const find = useDiffFind({ files: indexes.orderedFiles, jump: nav.jump, onFilesTab, showFiles: choices.showFiles })

  const setReaction = useReactionSetter(pull)
  const toggleViewed = useViewedToggle(local.markViewed, nav.setFileCollapsed)
  useFileKeyboardNav({
    enabled: detail.pr !== null && review.open === false,
    files: indexes.orderedFiles,
    current: nav.current,
    viewed: local.local.viewed,
    goTo: (path, expand) => nav.goTo(path, null, expand),
    markViewed: toggleViewed,
  })

  return {
    pull,
    ...choices,
    ...detail,
    ...local,
    ...indexes,
    review,
    ask,
    ...arrival,
    nav,
    threadFold,
    briefing,
    find,
    setReaction,
    toggleViewed,
  }
}

export type PullViewState = ReturnType<typeof usePullView>
