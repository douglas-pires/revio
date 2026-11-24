import type { Inbox as InboxData, PullSummary } from '@shared/inbox.types.ts'
import { EmptyState } from '../common/empty-state.component.tsx'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import type { OpenPull } from '../common/navigation.types.ts'
import { RefreshControl } from '../common/refresh-control.component.tsx'
import { Screen, ScreenBody, ScreenHeader } from '../common/screen.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { useAsyncAction } from '../common/use-async-action.hook.ts'
import { InboxRow } from '../inbox/inbox-row.component.tsx'
import { usePalettePage } from '../palette/use-palette-page.hook.ts'
import { groupMyPulls } from './my-pulls.util.ts'

/** Your PRs carry no stack chip (stacks are found for review requests), so there is no stack to open. */
const ignoreStackClick = () => {
  // Nothing to do.
}

/** One group of your PRs under its heading; nothing when the group is empty. */
function PullGroup(props: {
  title: string
  hint: string
  pulls: readonly PullSummary[]
  tone?: 'danger' | undefined
  onOpen: OpenPull
}) {
  if (props.pulls.length === 0) {
    return null
  }
  return (
    <section className="mb-6">
      <SectionHeading title={props.title} count={props.pulls.length} hint={props.hint} tone={props.tone} />
      <ul className="card">
        {props.pulls.map((pull) => (
          <InboxRow key={pull.id} pr={pull} onOpen={props.onOpen} onStack={ignoreStackClick} time="updated" />
        ))}
      </ul>
    </section>
  )
}

/** Your own open PRs, grouped by what they need next: changes to make, ready to merge, in review, drafts. */
export function MyPulls({ inbox, onOpen }: { inbox: InboxData | null; onOpen: OpenPull }) {
  const refreshAction = useAsyncAction()
  const groups = groupMyPulls(inbox?.authored ?? [])
  const refresh = () => refreshAction.run(() => globalThis.revio.refreshInbox())
  usePalettePage({ name: 'My PRs', actions: [{ id: 'refresh', label: 'Refresh my PRs', run: refresh }] })
  return (
    <Screen
      header={
        <ScreenHeader
          title="My PRs"
          subtitle={inbox?.viewer && `Open PRs by @${inbox.viewer}`}
          actions={<RefreshControl fetchedAt={inbox?.fetchedAt} busy={refreshAction.busy} onRefresh={refresh} />}
        />
      }
    >
      <ScreenBody>
        <ErrorBanner className="mb-4">{refreshAction.error || inbox?.error}</ErrorBanner>
        {inbox === null && <div className="text-muted">Loading…</div>}
        {inbox !== null && inbox.authored.length === 0 && (
          <EmptyState title="No open PRs">PRs you open on GitHub show up here.</EmptyState>
        )}
        <PullGroup
          title="Changes requested"
          hint="your move"
          tone="danger"
          pulls={groups.changesRequested}
          onOpen={onOpen}
        />
        <PullGroup title="Approved" hint="ready to merge" pulls={groups.approved} onOpen={onOpen} />
        <PullGroup title="In review" hint="waiting on reviewers" pulls={groups.inReview} onOpen={onOpen} />
        <PullGroup title="Drafts" hint="not out for review yet" pulls={groups.drafts} onOpen={onOpen} />
      </ScreenBody>
    </Screen>
  )
}
