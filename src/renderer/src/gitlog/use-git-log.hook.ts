import type { Branches, CiState, Commit, CommitDetail, LocalRepo, LogPage, LogQuery } from '@shared/git-log.types.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'

/** Typing in a filter waits this long before asking git again. */
const FILTER_DELAY_MS = 300
const REPO_KEY = 'revio.gitLog.repo'

type LogFilters = Omit<LogQuery, 'skip'>

const NO_FILTERS: LogFilters = { branch: '', text: '', author: '', sinceDays: 0, path: '' }

function readStoredRepo() {
  try {
    return localStorage.getItem(REPO_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeRepo(repo: string) {
  try {
    localStorage.setItem(REPO_KEY, repo)
  } catch {
    // A convenience only: the first repository is picked next time.
  }
}

/** The log so far with a new page: the first page replaces it, later ones add to it. */
function appendPage(loaded: Commit[], page: LogPage, skip: number) {
  if (skip === 0) {
    return page.commits
  }
  return [...loaded, ...page.commits]
}

/**
 * The repository to open: `fixedRepo` when it has a clone here (none when it has not), else the one picked last
 * time, else the first.
 */
function pickInitialRepo(localRepos: readonly LocalRepo[], fixedRepo: string | undefined) {
  if (fixedRepo !== undefined) {
    const wanted = fixedRepo.toLowerCase()
    return localRepos.find((localRepo) => localRepo.repo === wanted)?.repo ?? ''
  }
  const storedRepo = readStoredRepo()
  return localRepos.find((localRepo) => localRepo.repo === storedRepo)?.repo ?? localRepos[0]?.repo ?? ''
}

/** The repositories with a clone here, and the one picked (remembered between visits unless it is fixed). */
function useRepoChoice(fixedRepo: string | undefined) {
  const [repos, setRepos] = useState<LocalRepo[] | null>(null)
  const [repo, setRepoState] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    globalThis.revio
      .listLocalRepos()
      .then((localRepos) => {
        setRepos(localRepos)
        setRepoState(pickInitialRepo(localRepos, fixedRepo))
      })
      .catch((failure) => setError(readErrorMessage(failure)))
  }, [fixedRepo])
  const setRepo = useCallback((next: string) => {
    storeRepo(next)
    setRepoState(next)
  }, [])
  return { repos, repo, setRepo, error }
}

/** The filters as typed, and the same filters once typing has paused (the ones git runs with). */
function useDebouncedFilters() {
  const [filters, setFilters] = useState<LogFilters>(NO_FILTERS)
  const [applied, setApplied] = useState<LogFilters>(NO_FILTERS)
  useEffect(() => {
    const timer = setTimeout(() => setApplied(filters), FILTER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [filters])
  return { filters, setFilters, applied }
}

/** CI states for commits as they load, asked once per commit and repository. */
function useCiStates(repo: string, commits: readonly Commit[]) {
  const [ci, setCi] = useState<Record<string, CiState>>({})
  const askedCi = useRef({ repo: '', hashes: new Set<string>() })
  useEffect(() => {
    if (askedCi.current.repo !== repo) {
      askedCi.current = { repo, hashes: new Set() }
      setCi({})
    }
    const unaskedHashes = commits.map((commit) => commit.hash).filter((hash) => !askedCi.current.hashes.has(hash))
    if (!repo || unaskedHashes.length === 0) {
      return
    }
    for (const hash of unaskedHashes) {
      askedCi.current.hashes.add(hash)
    }
    globalThis.revio
      .getCommitCi(repo, unaskedHashes)
      .then((states) => setCi((prev) => ({ ...prev, ...states })))
      .catch(() => {
        // No CI marks for these; the log works without them.
      })
  }, [repo, commits])
  return ci
}

/** The commit picked in the log and its details. */
function useSelectedCommit(repo: string) {
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<CommitDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setDetail(null)
    setError(null)
    if (!(repo && selected)) {
      return
    }
    let stillSelected = true
    globalThis.revio
      .getCommit(repo, selected)
      .then((commitDetail) => {
        if (stillSelected) {
          setDetail(commitDetail)
        }
      })
      .catch((failure) => {
        if (stillSelected) {
          setError(readErrorMessage(failure))
        }
      })
    return () => {
      stillSelected = false
    }
  }, [repo, selected])
  return { selected, setSelected, detail, error }
}

/** The repository's branches; `reload` reads them again. */
function useBranches(repo: string) {
  const [branches, setBranches] = useState<Branches | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(() => {
    setError(null)
    if (!repo) {
      return
    }
    globalThis.revio
      .getBranches(repo)
      .then(setBranches)
      .catch((failure) => setError(readErrorMessage(failure)))
  }, [repo])
  useEffect(() => {
    setBranches(null)
    reload()
  }, [reload])
  return { branches, error, reload }
}

/** Pages of the log for the applied filters. Each load is numbered, so a slow older answer never wins. */
function useLogPages(repo: string, applied: LogFilters) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestLoad = useRef(0)
  const load = useCallback(
    async (skip: number) => {
      if (!repo) {
        return
      }
      latestLoad.current += 1
      const loadId = latestLoad.current
      setLoading(true)
      setError(null)
      try {
        const page = await globalThis.revio.getLog(repo, { ...applied, skip })
        if (latestLoad.current === loadId) {
          setCommits((loaded) => appendPage(loaded, page, skip))
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
    [repo, applied],
  )
  useEffect(() => {
    load(0)
  }, [load])
  return { commits, more, loading, error, load }
}

/**
 * Everything the git log shows: repositories, branches, the log with its filters, CI and the open commit.
 * `fixedRepo` keeps it on one repository (a PR's), which is never remembered as the log screen's choice.
 */
function useGitLog(fixedRepo?: string) {
  const choice = useRepoChoice(fixedRepo)
  const { repo } = choice
  const { filters, setFilters, applied } = useDebouncedFilters()
  const branches = useBranches(repo)
  const pages = useLogPages(repo, applied)
  const ci = useCiStates(repo, pages.commits)
  const commit = useSelectedCommit(repo)

  // Another repository starts unfiltered, with nothing picked.
  const { setSelected } = commit
  useEffect(() => {
    if (repo) {
      setFilters(NO_FILTERS)
      setSelected(null)
    }
  }, [repo, setFilters, setSelected])

  return {
    ...choice,
    error: choice.error ?? branches.error ?? pages.error,
    branches: branches.branches,
    filters,
    setFilters,
    commits: pages.commits,
    more: pages.more,
    loading: pages.loading,
    loadMore: () => pages.load(pages.commits.length),
    reload: () => {
      branches.reload()
      pages.load(0)
    },
    ci,
    commit,
  }
}

export type { LogFilters }
export type GitLogState = ReturnType<typeof useGitLog>
export { NO_FILTERS, useGitLog }
