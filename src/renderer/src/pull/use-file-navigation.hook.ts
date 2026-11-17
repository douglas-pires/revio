import { useCallback, useEffect, useRef, useState } from 'react'
import type { PullDetail } from '@shared/pull.types'
import { useScrollToTarget, type ScrollTarget } from './use-scroll-to-target.hook'

/**
 * Which file is current, which are collapsed, and jumping to a file and line on the files tab.
 * `initialTarget` is jumped to once, after the first load has set which files start collapsed.
 */
export function useFileNavigation(opts: { pr: PullDetail | null; onFilesTab: boolean; showFiles: () => void; initialTarget?: ScrollTarget }) {
  const { pr, showFiles } = opts
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [current, setCurrent] = useState<string | null>(null)
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null)

  const goTo = useCallback(
    (path: string, line: number | null = null, expand = true, commentId?: number) => {
      showFiles()
      setCurrent(path)
      if (expand) setCollapsed((c) => ({ ...c, [path]: false }))
      setScrollTarget({ path, line, commentId })
    },
    [showFiles],
  )

  const pendingTarget = useRef(opts.initialTarget)
  useEffect(() => {
    const target = pendingTarget.current
    if (!pr || !target) return
    pendingTarget.current = undefined
    goTo(target.path, target.line, true, target.commentId)
  }, [pr, goTo])

  const clearScrollTarget = useCallback(() => setScrollTarget(null), [])
  useScrollToTarget(scrollTarget, opts.onFilesTab, clearScrollTarget)

  const setFileCollapsed = useCallback((path: string, value: boolean) => setCollapsed((c) => ({ ...c, [path]: value })), [])
  const collapseFiles = useCallback((paths: readonly string[]) => setCollapsed((c) => ({ ...c, ...Object.fromEntries(paths.map((p) => [p, true])) })), [])

  return { collapsed, replaceCollapsed: setCollapsed, setFileCollapsed, collapseFiles, current, goTo }
}
