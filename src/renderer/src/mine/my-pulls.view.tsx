import type { Inbox as InboxData, PullSummary } from '@shared/inbox.types.ts'
import { EmptyState } from '../common/empty-state.component.tsx'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import type { OpenPull } from '../common/navigation.types.ts'
import { RefreshControl } from '../common/refresh-control.component.tsx'
import { Screen, ScreenBody, ScreenHeader } from '../common/screen.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { useAsyncAction } from '../common/use-async-action.hook.ts'
import { InboxRow } from '../inbox/inbox-row.component.tsx'
import { groupMyPulls } from './my-pulls.util.ts'

/** Your PRs carry no stack chip (stacks are found for review requests), so there is no stack to open. */
const NO_STACK = () => {
  // Nothing to do.
}

function Group(props: {
  title: string
  hint: string
  prs: readonly PullSummary[]
  tone?: 'danger' | undefined
  onOpen: OpenPull
}) {
  if (props.prs.length === 0) {
    return null
  }
  return (
    <section className="mb-6">
      <SectionHeading title={props.title} count={props.prs.length} hint={props.hint} tone={props.tone} />
      <ul className="card">
        {props.prs.map((pr) => (
          <InboxRow key={pr.id} pr={pr} onOpen={props.onOpen} onStack={NO_STACK} showUpdated={true} />
        ))}
      </ul>
    </section>
  )
}

/** Your own open PRs, grouped by what they need next: changes to make, ready to merge, in review, drafts. */
export function MyPulls({ inbox, onOpen }: { inbox: InboxData | null; onOpen: OpenPull }) {
  const refreshAction = useAsyncAction()
  const groups = groupMyPulls(inbox?.mine ?? [])
  const refresh = () => refreshAction.run(() => globalThis.revio.refreshInbox())
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
        {inbox !== null && inbox.mine.length === 0 && (
          <EmptyState title="No open PRs">PRs you open on GitHub show up here.</EmptyState>
        )}
        <Group title="Changes requested" hint="your move" tone="danger" prs={groups.changesRequested} onOpen={onOpen} />
        <Group title="Approved" hint="ready to merge" prs={groups.approved} onOpen={onOpen} />
        <Group title="In review" hint="waiting on reviewers" prs={groups.inReview} onOpen={onOpen} />
        <Group title="Drafts" hint="not out for review yet" prs={groups.drafts} onOpen={onOpen} />
      </ScreenBody>
    </Screen>
  )
}
