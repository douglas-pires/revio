import { useEffect, useMemo, useRef, useState } from 'react'
import type { PullFile } from '@shared/pull.types'
import { parsePatch } from './diff.util'
import { searchDiffs, stepMatch, type DiffMatch } from './diff-search.util'
import { cellOf, rangesIn } from './find-highlights.util'
import type { ScrollTarget } from './use-scroll-to-target.hook'

const ALL = 'revio-find'
const CURRENT = 'revio-find-current'

/**
 * Find in the changed files (⌘F): searches every file's diff, not only the rendered ones, steps through the matches
 * (Enter, ⇧Enter, ⌘G, ⇧⌘G) and highlights those on screen with the CSS Custom Highlight API, so the diff's markup is
 * never touched.
 */
export function useDiffFind(opts: { files: readonly PullFile[]; jump: (target: ScrollTarget) => void; onFilesTab: boolean; showFiles: () => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [index, setIndex] = useState<number | null>(null)
  const [focusTick, setFocusTick] = useState(0)

  const parsed = useMemo(() => opts.files.map((f) => ({ path: f.path, rows: f.patch ? parsePatch(f.patch) : [] })), [opts.files])
  const deferred = useDeferredQuery(query)
  const matches = useMemo(() => (open && deferred ? searchDiffs(parsed, deferred, { caseSensitive }) : []), [open, parsed, deferred, caseSensitive])
  const current = index != null ? (matches[index] ?? null) : null

  // A new search starts over; the first step lands on the first match.
  useEffect(() => setIndex(null), [matches])

  const { jump } = opts
  const go = (direction: 1 | -1) => {
    const next = stepMatch(index, matches.length, direction)
    if (next == null) return
    setIndex(next)
    const m = matches[next]!
    jump({ path: m.path, line: m.line, side: m.side })
  }

  const latest = useRef({ go, open, showFiles: opts.showFiles })
  latest.current = { go, open, showFiles: opts.showFiles }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'f') {
        e.preventDefault()
        latest.current.showFiles()
        setOpen(true)
        setFocusTick((t) => t + 1)
      } else if (key === 'g' && latest.current.open) {
        e.preventDefault()
        latest.current.go(e.shiftKey ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useMatchHighlights(open && opts.onFilesTab ? deferred : '', caseSensitive, current)

  return {
    open,
    query,
    setQuery,
    caseSensitive,
    setCaseSensitive,
    matches,
    index,
    focusTick,
    next: () => go(1),
    previous: () => go(-1),
    close: () => {
      setOpen(false)
      setIndex(null)
    },
  }
}

/** The query once typing pauses, so a big PR is not searched on every keystroke. */
function useDeferredQuery(query: string) {
  const [settled, setSettled] = useState(query)
  useEffect(() => {
    const t = setTimeout(() => setSettled(query), query.length < 3 ? 250 : 120)
    return () => clearTimeout(t)
  }, [query])
  return settled
}

/** Paints every rendered match, and the current one apart, again whenever the diff's DOM changes. */
function useMatchHighlights(query: string, caseSensitive: boolean, current: DiffMatch | null) {
  useEffect(() => {
    const registry = CSS.highlights
    if (!registry) return
    const clear = () => {
      registry.delete(ALL)
      registry.delete(CURRENT)
    }
    const scope = document.querySelector('[data-find-scope]')
    if (!query || !scope) return clear
    let raf = 0
    const paint = () => {
      raf = 0
      const options = { caseSensitive }
      registry.set(ALL, new Highlight(...[...scope.querySelectorAll('td[data-row]')].flatMap((cell) => rangesIn(cell, query, options))))
      const cell = current && cellOf(current)
      const range = cell && rangesIn(cell, query, options)[current.nth]
      if (range) registry.set(CURRENT, new Highlight(range))
      else registry.delete(CURRENT)
    }
    const schedule = () => (raf ||= requestAnimationFrame(paint))
    paint()
    const observer = new MutationObserver(schedule)
    observer.observe(scope, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
      clear()
    }
  }, [query, caseSensitive, current])
}
