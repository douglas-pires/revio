import { useCallback, useEffect, useState } from 'react'
import { clampPanelHeight, DEFAULT_PANEL_HEIGHT_PX } from './pull-git-log.util.ts'

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
