import { countOf, formatAge } from '../common/format.util.ts'
import type { CommitStepState } from './use-commit-step.hook.ts'

/** Above the diff while one commit shows: which, by whom, how many files, and why comments are off. */
export function CommitBanner({ commitStep }: { commitStep: CommitStepState }) {
  const { commit, index } = commitStep
  if (!commit || index === null) {
    return null
  }
  return (
    <div className="mx-4 mt-4 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-[12.5px]">
      <p>
        <span className="font-medium">
          Commit {index + 1} of {commitStep.commits.length}
        </span>{' '}
        <span className="font-mono text-[11.5px] text-muted">{commit.shortSha}</span> {commit.headline}
      </p>
      <p className="mt-0.5 text-muted">
        by {commit.author} · {formatAge(commit.date)} ago
        {!commitStep.loading && commitStep.error === null && ` · ${countOf(commitStep.files.length, 'file', 'files')}`}{' '}
        · Comments are off here: a commit’s lines don’t match the PR’s latest version. Pick All commits to comment.
      </p>
      {Boolean(commit.isMerge) && (
        <p className="mt-0.5 text-muted">A merge: only the files the PR itself changes are shown.</p>
      )}
      {Boolean(commitStep.loading) && <p className="mt-1 text-muted">Loading the commit…</p>}
      {commitStep.error !== null && <p className="mt-1 text-danger">{commitStep.error}</p>}
    </div>
  )
}
