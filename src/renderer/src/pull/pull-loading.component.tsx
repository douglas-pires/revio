import type { Stack } from '@shared/inbox.types.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { InnerTabs } from '../common/inner-tabs.component.tsx'
import { ListSkeleton } from '../common/list-skeleton.component.tsx'
import { MascotLoading } from '../common/mascot-loading.component.tsx'
import type { OpenPull } from '../common/navigation.types.ts'
import { PanelHeader } from '../common/panel-header.component.tsx'
import { ScreenHeader } from '../common/screen.component.tsx'
import { BranchNames } from './branch-names.component.tsx'
import type { PullTab } from './pull-tabs.util.ts'
import { listPullTabs } from './pull-tabs.util.ts'
import { StackBar } from './stack-bar.component.tsx'
import { findKnownStackPr } from './stack-memory.util.ts'

const AVATAR_PX = 28
const FILE_ROWS = 5

/** The header from what the stack already says about this PR (title, author, branches), else its number. */
function LoadingHeader({ pull }: { pull: PullRef }) {
  const known = findKnownStackPr(pull)
  if (!known) {
    return <ScreenHeader title={`${pull.repo}#${pull.number}`} subtitle="Loading…" />
  }
  return (
    <ScreenHeader
      leading={
        <img
          src={known.authorAvatar}
          alt=""
          width={AVATAR_PX}
          height={AVATAR_PX}
          className="size-7 shrink-0 rounded-full"
        />
      }
      title={
        <>
          {known.title} <span className="font-normal text-muted">#{known.number}</span>
        </>
      }
      subtitle={
        <>
          {known.repo} · {known.author} wants to merge <BranchNames head={known.headRef} base={known.baseRef} />
        </>
      }
    />
  )
}

/**
 * A PR's screen while its details load, laid out like the loaded one: the header, the stack bar (where it was
 * scrolled), the files column and the tabs stay put, and only the code panel shows that it is loading.
 */
export function PullLoading(props: {
  pull: PullRef
  stack: Stack | null
  tab: PullTab
  onTab: (tab: PullTab) => void
  onOpenPull: OpenPull
}) {
  return (
    <div className="flex h-full flex-col">
      <LoadingHeader pull={props.pull} />
      {props.stack !== null && <StackBar stack={props.stack} pull={props.pull} onOpen={props.onOpenPull} />}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-panel">
          <PanelHeader title="Files" />
          <div className="p-3">
            <ListSkeleton rows={FILE_ROWS} rowHeight="h-5" onPanel={true} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <InnerTabs tabs={listPullTabs(undefined)} value={props.tab} onChange={props.onTab} />
          <MascotLoading label={`Reading #${props.pull.number}…`} />
        </div>
      </div>
    </div>
  )
}
