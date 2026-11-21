import type { PullDetail, PullRef } from '@shared/pull.types.ts'
import { useState } from 'react'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import type { OpenPull, PullTarget } from '../common/navigation.types.ts'
import { Screen, ScreenBody, ScreenHeader } from '../common/screen.component.tsx'
import { FileTree } from './file-tree.component.tsx'
import { GitLogPanel } from './git-log-panel.component.tsx'
import { PullHeader } from './pull-header.component.tsx'
import { PullLoading } from './pull-loading.component.tsx'
import { PullSidePanels } from './pull-side-panels.component.tsx'
import { PullTabs } from './pull-tabs.component.tsx'
import { StackBar } from './stack-bar.component.tsx'
import { UnsentScopeContext } from './unsent-comments.util.ts'
import type { CommitPick } from './use-pull-git-log.hook.ts'
import { type PullViewState, usePullView } from './use-pull-view.hook.ts'
import { ReactionsContext } from './use-reactions.hook.ts'
import { ReplyTargetContext } from './use-reply-target.hook.ts'
import { ThreadFoldContext } from './use-thread-fold.hook.ts'

interface PullViewProps {
  pull: PullRef
  /** Where to open: a file, line or comment (e.g. from a review thread or a mention), or a conversation comment. */
  initialTarget?: PullTarget | undefined
  onBack: () => void
  /** After a review is submitted: the reviewer is done with this PR. */
  onReviewed: () => void
  onEditGuidelines: (repo: string, path?: string) => void
  onOpenPull: OpenPull
}

/** The file the git log follows: the one open in Files changed, none on the other tabs. */
function readOpenPath(view: PullViewState) {
  if (view.tab !== 'files') {
    return null
  }
  return view.nav.current ?? null
}

/** The header, with the review popover that submits your review and its pending comments. */
function PullViewHeader({ view, pr, props }: { view: PullViewState; pr: PullDetail; props: PullViewProps }) {
  const { review } = view
  const savedAsks = view.local.asks ?? []
  let askCount = savedAsks.length
  if (view.ask.thread !== null) {
    askCount = 0
  }
  return (
    <PullHeader
      pr={pr}
      draftCount={view.local.drafts.length}
      askCount={askCount}
      onOpenAsks={() => view.ask.setThread(savedAsks[0] ?? null)}
      reviewOpen={review.open}
      setReviewOpen={review.setOpen}
      reviewBody={review.body}
      setReviewBody={review.setBody}
      onSubmitReview={async (event) => {
        const { repo, number } = view.pull
        const response = await globalThis.revio.submitReview({
          repo,
          number,
          headSha: pr.headSha,
          event,
          body: review.body,
        })
        review.setBody('')
        review.setOpen(false)
        view.forgetDrafts()
        props.onReviewed()
        return response.url
      }}
    />
  )
}

export function PullView(props: PullViewProps) {
  const view = usePullView(props.pull, props.initialTarget)
  const [commitPick, setCommitPick] = useState<CommitPick | null>(null)
  const { pr } = view
  if (view.error) {
    return (
      <Screen
        header={<ScreenHeader title={`${props.pull.repo}#${props.pull.number}`} subtitle="Couldn't open this PR" />}
      >
        <ScreenBody>
          <ErrorBanner className="mb-4">{view.error}</ErrorBanner>
          <button type="button" className="btn" onClick={props.onBack}>
            Back to the inbox
          </button>
        </ScreenBody>
      </Screen>
    )
  }
  if (!pr) {
    return (
      <PullLoading
        pull={props.pull}
        stack={view.stack}
        tab={view.tab}
        onTab={view.setTab}
        onOpenPull={props.onOpenPull}
      />
    )
  }
  return (
    <ReactionsContext value={view.setReaction}>
      <ReplyTargetContext value={view.replyTarget}>
        <UnsentScopeContext value={`${props.pull.repo}#${props.pull.number}`}>
          <ThreadFoldContext value={view.threadFold}>
            <div className="flex h-full flex-col">
              <PullViewHeader view={view} pr={pr} props={props} />
              {view.stack !== null && <StackBar stack={view.stack} pull={view.pull} onOpen={props.onOpenPull} />}
              <div className="flex min-h-0 flex-1">
                <FileTree
                  files={pr.files}
                  viewed={view.local.viewed}
                  current={view.nav.current}
                  focusPaths={view.focusPaths}
                  ignorePaths={view.ignorePaths}
                  draftCounts={view.draftCounts}
                  onSelect={view.nav.goTo}
                />
                <PullTabs
                  view={view}
                  pr={pr}
                  onEditGuidelines={props.onEditGuidelines}
                  onOpenCommit={(sha) => setCommitPick({ sha })}
                />
                <PullSidePanels view={view} pr={pr} />
              </div>
              <GitLogPanel
                repo={view.pull.repo}
                headSha={pr.headSha}
                headRef={pr.headRef}
                files={view.orderedFiles}
                openPath={readOpenPath(view)}
                commitPick={commitPick}
              />
            </div>
          </ThreadFoldContext>
        </UnsentScopeContext>
      </ReplyTargetContext>
    </ReactionsContext>
  )
}
