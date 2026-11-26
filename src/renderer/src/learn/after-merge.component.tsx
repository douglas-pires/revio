import type { AfterMergeReport, ApprovedPull, FollowUp } from '@shared/learn.types.ts'
import { EmptyState } from '../common/empty-state.component.tsx'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { countOf, formatAge } from '../common/format.util.ts'
import { MascotLoading } from '../common/mascot-loading.component.tsx'
import type { OpenPull } from '../common/navigation.types.ts'
import { MissLessonButton } from './miss-lesson.component.tsx'
import { useLoaded } from './use-loaded.hook.ts'

const loadFixes = () => globalThis.revio.listAfterMergeFixes()

/** Why a later PR is listed: always on evidence, said plainly, with more on hover. */
function describeReason(fix: FollowUp) {
  if (fix.reason === 'reverts') {
    return { label: 'reverted it', hint: 'A revert of the PR you approved.' }
  }
  if (fix.reason === 'says-fixes') {
    return {
      label: 'says it fixes it',
      hint: 'It says it fixes the PR you approved: "fixes #…", "regression from #…", or a fix title carrying its number.',
    }
  }
  return {
    label: `rewrote ${fix.rewrittenLines} of its lines`,
    hint: 'A fix, merged within 60 days, that removed or rewrote lines the PR you approved had added.',
  }
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
  const reason = describeReason(fix)
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

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** What the list covers: which approved PRs were checked, and what counts as a fix. */
function Coverage({ report }: { report: AfterMergeReport }) {
  let span = ''
  if (report.from && report.to) {
    span = `, merged between ${formatDay(report.from)} and ${formatDay(report.to)}`
  }
  return (
    <p className="mb-1.5 text-[12px] text-muted">
      Checked the {report.examined} most recent PRs you approved{span}. A later PR is listed only when it reverted one,
      said it fixed one, or rewrote lines it added.
    </p>
  )
}

/** PRs you approved that later needed fixing, each with its fixes and what the review could have caught. */
export function AfterMerge({ onOpen }: { onOpen: OpenPull }) {
  const { value: report, error } = useLoaded(loadFixes)
  if (error !== null) {
    return <ErrorBanner>{error}</ErrorBanner>
  }
  if (report === null) {
    return <MascotLoading label="Looking for fixes after the PRs you approved…" />
  }
  const { pulls } = report
  if (pulls.length === 0) {
    return (
      <>
        <Coverage report={report} />
        <EmptyState title="Nothing came back">
          No later PR reverted these, said it fixed them, or rewrote their lines.
        </EmptyState>
      </>
    )
  }
  const fixCount = pulls.reduce((total, pull) => total + pull.followUps.length, 0)
  return (
    <>
      <Coverage report={report} />
      <p className="mb-3 text-[12.5px] text-muted">
        {pulls.length} of them needed {countOf(fixCount, 'fix', 'fixes')} after merging. Not every bug is visible in a
        diff: ask Claude to compare, and keep the lessons worth keeping.
      </p>
      {pulls.map((pull) => (
        <ApprovedCard key={`${pull.repo}#${pull.number}`} pull={pull} onOpen={onOpen} />
      ))}
    </>
  )
}
