import type { ApprovedPull, FollowUp } from '@shared/learn.types.ts'
import { EmptyState } from '../common/empty-state.component.tsx'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { countOf, formatAge } from '../common/format.util.ts'
import { MascotLoading } from '../common/mascot-loading.component.tsx'
import type { OpenPull } from '../common/navigation.types.ts'
import { MissLessonButton } from './miss-lesson.component.tsx'
import { useLoaded } from './use-loaded.hook.ts'

const loadFixes = () => globalThis.revio.listAfterMergeFixes()

const REASONS: Record<FollowUp['reason'], { label: string; hint: string }> = {
  mentions: {
    label: 'links back to it',
    hint: 'This fix mentions the PR you approved: a revert, "fixes #…", or a link to it.',
  },
  'same-files': {
    label: 'fixed the same files',
    hint: 'A fix of files the PR you approved had changed, merged within 60 days of it. It may be unrelated: check the files.',
  },
}

/** A PR title that opens the PR in Revio. */
function PullLink({ pull, onOpen }: { pull: { repo: string; number: number; title: string }; onOpen: OpenPull }) {
  return (
    <button type="button" className="text-left font-medium hover:underline" onClick={() => onOpen(pull)}>
      {pull.title} <span className="font-normal text-muted">{`${pull.repo}#${pull.number}`}</span>
    </button>
  )
}

function FollowUpRow({ original, fix, onOpen }: { original: ApprovedPull; fix: FollowUp; onOpen: OpenPull }) {
  const reason = REASONS[fix.reason]
  return (
    <li className="border-t border-line px-4 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12.5px]">
        <span className="chip bg-danger/10 text-danger" title={reason.hint}>
          {reason.label}
        </span>
        <PullLink pull={fix} onOpen={onOpen} />
        <span className="text-[11.5px] text-muted">
          by {fix.author} · merged {formatAge(fix.mergedAt)} ago
        </span>
      </div>
      {fix.sharedFiles.length > 0 && (
        <div className="mt-1 truncate font-mono text-[11px] text-muted" title={fix.sharedFiles.join('\n')}>
          {fix.sharedFiles.join(' · ')}
        </div>
      )}
      <MissLessonButton original={original} fix={fix} saved={fix.lesson} pending={fix.lessonPending} />
    </li>
  )
}

function ApprovedCard({ pull, onOpen }: { pull: ApprovedPull; onOpen: OpenPull }) {
  return (
    <section className="card mb-3 overflow-hidden">
      <div className="px-4 py-2.5">
        <div className="text-[11.5px] text-muted">
          You approved this {formatAge(pull.approvedAt)} ago · by {pull.author} · merged {formatAge(pull.mergedAt)} ago
        </div>
        <PullLink pull={pull} onOpen={onOpen} />
      </div>
      <ul>
        {pull.followUps.map((fix) => (
          <FollowUpRow key={`${fix.repo}#${fix.number}`} original={pull} fix={fix} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  )
}

/** PRs you approved that later needed fixing, each with its fixes and what the review could have caught. */
export function AfterMerge({ onOpen }: { onOpen: OpenPull }) {
  const { value: pulls, error } = useLoaded(loadFixes)
  if (error !== null) {
    return <ErrorBanner>{error}</ErrorBanner>
  }
  if (pulls === null) {
    return <MascotLoading label="Looking for fixes after the PRs you approved…" />
  }
  if (pulls.length === 0) {
    return (
      <EmptyState title="Nothing came back">
        None of the PRs you approved in the last year was followed by a fix that names it, or by a fix of its files.
      </EmptyState>
    )
  }
  const fixCount = pulls.reduce((total, pull) => total + pull.followUps.length, 0)
  return (
    <>
      <p className="mb-3 text-[12.5px] text-muted">
        {countOf(pulls.length, 'PR', 'PRs')} you approved needed {countOf(fixCount, 'fix', 'fixes')} after merging. Not
        every bug is visible in a diff: ask Claude to compare, and keep the lessons worth keeping in a guide.
      </p>
      {pulls.map((pull) => (
        <ApprovedCard key={`${pull.repo}#${pull.number}`} pull={pull} onOpen={onOpen} />
      ))}
    </>
  )
}
