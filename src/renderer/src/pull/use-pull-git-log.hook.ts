import type { CiState, Commit, CommitDetail, LogPage } from '@shared/git-log.types.ts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { type LogFilters, NO_FILTERS } from '../gitlog/log-filters.types.ts'
import { prepareLogCommits, skipsCommits } from './pull-git-log.util.ts'

/** Typing in a filter waits this long before asking GitHub again. */
const FILTER_DELAY_MS = 400

/** The log so far with a new page: the first page replaces it, later ones add to it. */
function appendPage(loaded: Commit[], page: LogPage, pageNumber: number) {
  if (pageNumber === 1) {
    return page.commits
  }
  return [...loaded, ...page.commits]
}

/** The filters as typed, and the same filters once typing has paused (the ones GitHub is asked with). */
function useDebouncedFilters() {
  const [filters, setFilters] = useState<LogFilters>(NO_FILTERS)
  const [applied, setApplied] = useState<LogFilters>(NO_FILTERS)
  useEffect(() => {
    const timer = setTimeout(() => setApplied(filters), FILTER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [filters])
  return { filters, setFilters, applied }
}

/** Pages of the PR's history for the applied filters. Each load is numbered, so a slow older answer never wins. */
function useLogPages(source: PullLogSource, applied: LogFilters) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loadedPages, setLoadedPages] = useState(0)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestLoad = useRef(0)
  const { repo, headSha } = source
  const load = useCallback(
    async (pageNumber: number) => {
      latestLoad.current += 1
      const loadId = latestLoad.current
      setLoading(true)
      setError(null)
      try {
        const page = await globalThis.revio.getPullLog(repo, { ...applied, sha: headSha, page: pageNumber })
        if (latestLoad.current === loadId) {
          setCommits((loaded) => appendPage(loaded, page, pageNumber))
          setLoadedPages(pageNumber)
          setMore(page.more)
        }
      } catch (failure) {
        if (latestLoad.current === loadId) {
          setError(readErrorMessage(failure))
          setCommits([])
          setMore(false)
        }
      } finally {
        if (latestLoad.current === loadId) {
          setLoading(false)
        }
      }
    },
    [repo, headSha, applied],
  )
  useEffect(() => {
    load(1)
  }, [load])
  return { commits, more, loading, error, loadMore: () => load(loadedPages + 1) }
}

/** CI states for commits as they load, asked once per commit. */
function useCiStates(repo: string, commits: readonly Commit[]) {
  const [ci, setCi] = useState<Record<string, CiState>>({})
  const askedHashes = useRef(new Set<string>())
  useEffect(() => {
    const unaskedHashes = commits.map((commit) => commit.hash).filter((hash) => !askedHashes.current.has(hash))
    if (unaskedHashes.length === 0) {
      return
    }
    for (const hash of unaskedHashes) {
      askedHashes.current.add(hash)
    }
    globalThis.revio
      .getCommitCi(repo, unaskedHashes)
      .then((states) => setCi((known) => ({ ...known, ...states })))
      .catch(() => {
        // No CI marks for these; the log works without them.
      })
  }, [repo, commits])
  return ci
}

/** The commit picked in the log and its details from GitHub. */
function useSelectedCommit(repo: string) {
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<CommitDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setDetail(null)
    setError(null)
    if (!selected) {
      return
    }
    let stillSelected = true
    globalThis.revio
      .getCommitDetail(repo, selected)
      .then((commitDetail) => stillSelected && setDetail(commitDetail))
      .catch((failure) => stillSelected && setError(readErrorMessage(failure)))
    return () => {
      stillSelected = false
    }
  }, [repo, selected])
  return { selected, setSelected, detail, error }
}

/** Which PR's history the log reads: its repository, and its head commit and branch. */
export interface PullLogSource {
  repo: string
  headSha: string
  headRef: string
}

/**
 * The PR's git log, read from GitHub: the history from the PR's head, with its filters, CI and the picked commit.
 * While `followPath` is on, the path filter follows the file open in Files changed (none on the other tabs).
 */
export function usePullGitLog(source: PullLogSource, openPath: string | null, followPath: boolean) {
  const { filters, setFilters, applied } = useDebouncedFilters()
  const pages = useLogPages(source, applied)
  const ci = useCiStates(source.repo, pages.commits)
  const commit = useSelectedCommit(source.repo)
  useEffect(() => {
    if (followPath) {
      setFilters((current) => ({ ...current, path: openPath ?? '' }))
    }
  }, [openPath, followPath, setFilters])
  const { headSha, headRef } = source
  const commits = useMemo(
    () => prepareLogCommits(pages.commits, { skipsCommits: skipsCommits(applied), headSha, headRef }),
    [pages.commits, applied, headSha, headRef],
  )
  return { ...pages, commits, filters, setFilters, ci, commit }
}

export type PullGitLogState = ReturnType<typeof usePullGitLog>
