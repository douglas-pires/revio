import { useCallback, useEffect, useRef, useState } from 'react'
import { useGitLog } from '../gitlog/use-git-log.hook.ts'
import { clampPanelHeight, DEFAULT_PANEL_HEIGHT_PX, pickPullBranch } from './pull-git-log.util.ts'

const PANEL_KEY = 'revio.pullGitLog'

interface PanelLayout {
  open: boolean
  height: number
}

function readStoredLayout(): PanelLayout {
  try {
    const stored = JSON.parse(localStorage.getItem(PANEL_KEY) ?? '{}') as Partial<PanelLayout>
    return { open: stored.open === true, height: stored.height ?? DEFAULT_PANEL_HEIGHT_PX }
  } catch {
    return { open: false, height: DEFAULT_PANEL_HEIGHT_PX }
  }
}

function storeLayout(layout: PanelLayout) {
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify(layout))
  } catch {
    // A convenience only: the panel opens closed, at its default height, next time.
  }
}

/** Whether the panel is open and how tall, kept between PRs; Ctrl+` opens and closes it, as a terminal does. */
export function usePanelLayout() {
  const [layout, setLayoutState] = useState(readStoredLayout)
  const setLayout = useCallback((update: (current: PanelLayout) => PanelLayout) => {
    setLayoutState((current) => {
      const next = update(current)
      storeLayout(next)
      return next
    })
  }, [])
  const toggle = useCallback(() => setLayout((current) => ({ ...current, open: !current.open })), [setLayout])
  const resize = useCallback(
    (height: number) => setLayout((current) => ({ ...current, height: clampPanelHeight(height, window.innerHeight) })),
    [setLayout],
  )
  useEffect(() => {
    const toggleOnShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === 'Backquote') {
        event.preventDefault()
        toggle()
      }
    }
    globalThis.addEventListener('keydown', toggleOnShortcut)
    return () => globalThis.removeEventListener('keydown', toggleOnShortcut)
  }, [toggle])
  return { ...layout, toggle, resize }
}

/**
 * The git log of the PR's repository: it starts on the PR's branch once the branches load, and while `followPath` is
 * on, its path filter follows the file open in Files changed (none on the other tabs).
 */
export function usePullGitLog(repo: string, headRef: string, openPath: string | null, followPath: boolean) {
  const gitLog = useGitLog(repo)
  const { branches, repo: cloneRepo, setFilters } = gitLog
  const branchPickedFor = useRef('')
  useEffect(() => {
    if (!branches || branchPickedFor.current === cloneRepo) {
      return
    }
    branchPickedFor.current = cloneRepo
    const branch = pickPullBranch(branches.branches, headRef)
    setFilters((filters) => ({ ...filters, branch }))
  }, [branches, cloneRepo, headRef, setFilters])
  useEffect(() => {
    if (cloneRepo && followPath) {
      setFilters((filters) => ({ ...filters, path: openPath ?? '' }))
    }
  }, [cloneRepo, openPath, followPath, setFilters])
  return gitLog
}
