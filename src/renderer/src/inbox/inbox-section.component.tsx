import type { PullSummary } from '@shared/inbox.types.ts'
import { EmptyState } from '../common/empty-state.component.tsx'
import type { OpenPull } from '../common/navigation.types.ts'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { InboxRow } from './inbox-row.component.tsx'

export function InboxSection(props: {
  title: string
  hint?: string | undefined
  items: readonly PullSummary[]
  onOpen: OpenPull
  onStack: (id: string) => void
  tone?: 'danger' | undefined
  muted?: boolean | undefined
  empty?: string | undefined
}) {
  if (!(props.items.length > 0 || props.empty)) {
    return null
  }
  return (
    <section className="mb-6">
      <SectionHeading title={props.title} count={props.items.length} hint={props.hint} tone={props.tone} />
      {props.items.length > 0 && (
        <ul className="card">
          {props.items.map((pull) => (
            <InboxRow key={pull.id} pr={pull} onOpen={props.onOpen} onStack={props.onStack} muted={props.muted} />
          ))}
        </ul>
      )}
      {props.items.length === 0 && <EmptyState>{props.empty}</EmptyState>}
    </section>
  )
}
