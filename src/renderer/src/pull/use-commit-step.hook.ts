import type { PullCommit } from '@shared/history.types.ts'
import type { PullDetail, PullFile, PullRef } from '@shared/pull.types.ts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { stepCommit, toCommitPullFiles } from './commit-step.util.ts'
import { groupByDir } from './files.util.ts'

/** The PR's commits, oldest first, once there is more than one to step through. */
function usePullCommits(pull: PullRef, pr: PullDetail | null) {
  const [commits, setCommits] = useState<PullCommit[]>([])
  const headSha = pr?.headSha
  const several = (pr?.commitCount ?? 0) > 1
  useEffect(() => {
    if (!(headSha && several)) {
      setCommits([])
      return
    }
    let live = true
    globalThis.revio
      .getPullCommits(pull, headSha)
      .then((loaded) => live && setCommits(loaded))
      // Without the list there is nothing to step through.
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [pull, headSha, several])
  return commits
}

/** The picked commit's files, read at that commit. */
function useCommitFiles(pull: PullRef, commit: PullCommit | null, prFiles: readonly PullFile[]) {
  const [files, setFiles] = useState<PullFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setFiles(null)
    setError(null)
    if (!commit) {
      return
    }
    let live = true
    globalThis.revio
      .getCommitFiles({ repo: pull.repo, sha: commit.sha })
      .then((loaded) => live && setFiles(toCommitPullFiles(loaded, prFiles, commit)))
      .catch((failure: unknown) => live && setError(readErrorMessage(failure)))
    return () => {
      live = false
    }
  }, [pull, commit, prFiles])
  return { files, error }
}

/** The commit at `index`, or null for all of them. */
function pickCommit(commits: readonly PullCommit[], index: number | null) {
  if (index === null) {
    return null
  }
  return commits[index] ?? null
}

/**
 * Stepping through the PR's commits one at a time: which one is picked (null for all of them), its files, and
 * moving to the next or previous. Only offered when the PR has more than one commit.
 */
export function useCommitStep(pull: PullRef, pr: PullDetail | null) {
  const commits = usePullCommits(pull, pr)
  const [index, setIndex] = useState<number | null>(null)
  const commit = useMemo(() => pickCommit(commits, index), [index, commits])
  const prFiles = useMemo(() => pr?.files ?? [], [pr])
  const { files, error } = useCommitFiles(pull, commit, prFiles)
  const step = useCallback((by: 1 | -1) => setIndex((current) => stepCommit(current, by, commits.length)), [commits])
  const ordered = useMemo(() => groupByDir(files ?? []).flatMap(([, grouped]) => grouped), [files])
  return {
    available: commits.length > 1,
    commits,
    index,
    commit,
    select: setIndex,
    step,
    /** The picked commit's files in the sidebar's order; empty while loading or when all commits are shown. */
    files: ordered,
    loading: commit !== null && files === null && error === null,
    error,
  }
}

export type CommitStepState = ReturnType<typeof useCommitStep>
