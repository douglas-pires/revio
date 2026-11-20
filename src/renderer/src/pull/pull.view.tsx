import type { PullDetail, PullRef } from '@shared/pull.types.ts'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import type { OpenPull, PullTarget } from '../common/navigation.types.ts'
import { FileTree } from './file-tree.component.tsx'
import { PullHeader } from './pull-header.component.tsx'
import { PullSidePanels } from './pull-side-panels.component.tsx'
import { PullTabs } from './pull-tabs.component.tsx'
import { StackBar } from './stack-bar.component.tsx'
import { UnsentScopeContext } from './unsent-comments.util.ts'
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

/** The header, with the review popover that submits your review and its pending comments. */
function PullViewHeader({ v, pr, props }: { v: PullViewState; pr: PullDetail; props: PullViewProps }) {
  const { review } = v
  const savedAsks = v.local.asks ?? []
  let askCount = savedAsks.length
  if (v.ask.thread !== null) {
    askCount = 0
  }
  return (
    <PullHeader
      pr={pr}
      draftCount={v.local.drafts.length}
      askCount={askCount}
      onOpenAsks={() => v.ask.setThread(savedAsks[0] ?? null)}
      onBack={props.onBack}
      reviewOpen={review.open}
      setReviewOpen={review.setOpen}
      reviewBody={review.body}
      setReviewBody={review.setBody}
      onSubmitReview={async (event) => {
        const { repo, number } = v.pull
        const res = await globalThis.revio.submitReview({ repo, number, headSha: pr.headSha, event, body: review.body })
        review.setBody('')
        review.setOpen(false)
        v.forgetDrafts()
        props.onReviewed()
        return res.url
      }}
    />
  )
}

export function PullView(props: PullViewProps) {
  const v = usePullView(props.pull, props.initialTarget)
  const { pr } = v
  if (v.error) {
    return (
      <div className="p-6">
        <button type="button" className="btn mb-4" onClick={props.onBack}>
          ← Inbox
        </button>
        <ErrorBanner>{v.error}</ErrorBanner>
      </div>
    )
  }
  if (!pr) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        Loading {props.pull.repo}#{props.pull.number}…
      </div>
    )
  }
  return (
    <ReactionsContext value={v.setReaction}>
      <ReplyTargetContext value={v.replyTarget}>
        <UnsentScopeContext value={`${props.pull.repo}#${props.pull.number}`}>
          <ThreadFoldContext value={v.threadFold}>
            <div className="flex h-full flex-col">
              <PullViewHeader v={v} pr={pr} props={props} />
              {v.stack !== null && <StackBar stack={v.stack} pull={v.pull} onOpen={props.onOpenPull} />}
              <div className="flex min-h-0 flex-1">
                <FileTree
                  files={pr.files}
                  viewed={v.local.viewed}
                  current={v.nav.current}
                  focusPaths={v.focusPaths}
                  ignorePaths={v.ignorePaths}
                  draftCounts={v.draftCounts}
                  onSelect={v.nav.goTo}
                />
                <PullTabs v={v} pr={pr} onEditGuidelines={props.onEditGuidelines} />
                <PullSidePanels v={v} pr={pr} />
              </div>
            </div>
          </ThreadFoldContext>
        </UnsentScopeContext>
      </ReplyTargetContext>
    </ReactionsContext>
  )
}
