import type { PullDetail, PullFile, PullRef } from '@shared/pull.types.ts'
import { useShortcut } from '../shortcuts/use-shortcut.hook.ts'
import { type CommitStepState, useCommitStep } from './use-commit-step.hook.ts'
import { type SinceReviewState, useSinceReview } from './use-since-review.hook.ts'

/** The files the Files tab lists: one commit's, the changes since your review, or the whole PR. */
function pickShownFiles(commitStep: CommitStepState, sinceReview: SinceReviewState, orderedFiles: PullFile[]) {
  if (commitStep.commit) {
    return commitStep.files
  }
  if (sinceReview.on) {
    return sinceReview.files
  }
  return orderedFiles
}

/** What a shortcut does: show Files changed and act; nothing when `available` is false. */
function whenAvailable(available: boolean, showFiles: () => void, act: () => void) {
  if (!available) {
    return null
  }
  return () => {
    showFiles()
    act()
  }
}

/**
 * What the Files tab shows: the whole PR, only the changes since your review, or one commit at a time; one of the
 * two narrower views at once. Also which commit its diffs are read at, and the shortcuts that switch between them.
 */
export function useDiffScope(pull: PullRef, pr: PullDetail | null, orderedFiles: PullFile[], showFiles: () => void) {
  const sinceReview = useSinceReview(pull, pr)
  const commitStep = useCommitStep(pull, pr)
  const toggleSince = () => {
    commitStep.select(null)
    sinceReview.toggle()
  }
  const stepCommit = (by: 1 | -1) => {
    sinceReview.turnOff()
    commitStep.step(by)
  }
  useShortcut('since-review', whenAvailable(sinceReview.available, showFiles, toggleSince))
  useShortcut(
    'next-commit',
    whenAvailable(commitStep.available, showFiles, () => stepCommit(1)),
  )
  useShortcut(
    'previous-commit',
    whenAvailable(commitStep.available, showFiles, () => stepCommit(-1)),
  )
  return {
    sinceReview,
    commitStep,
    toggleSince,
    stepCommit,
    selectCommit: (index: number | null) => {
      sinceReview.turnOff()
      commitStep.select(index)
    },
    shownFiles: pickShownFiles(commitStep, sinceReview, orderedFiles),
    /** The commit the shown diffs are read at: the picked commit, else the PR's head. */
    shownSha: commitStep.commit?.sha ?? pr?.headSha ?? '',
  }
}
