import type { PullFile } from '@shared/pull.types.ts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { parsePatch } from './diff.util.ts'
import { type DiffMatch, searchDiffs, stepMatch } from './diff-search.util.ts'
import { cellOf, rangesIn } from './find-highlights.util.ts'
import type { ScrollTarget } from './use-scroll-to-target.hook.ts'

const ALL = 'revio-find'

const CURRENT = 'revio-find-current'
/** Short queries match a lot, so they wait longer for the next keystroke before searching. */
const SHORT_QUERY = 3
const SHORT_QUERY_DELAY_MS = 250
const QUERY_DELAY_MS = 120

function delayFor(query: string) {
  if (query.length < SHORT_QUERY) {
    return SHORT_QUERY_DELAY_MS
  }
  return QUERY_DELAY_MS
}

/** ⌘G steps forward, ⇧⌘G back. */
function directionOf(shift: boolean): 1 | -1 {
  if (shift) {
    return -1
  }
  return 1
}

/** The query once typing pauses, so a big PR is not searched on every keystroke. */
function useDeferredQuery(query: string) {
  const [settled, setSettled] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), delayFor(query))
    return () => clearTimeout(timer)
  }, [query])
  return settled
}

/** Paints every rendered match, and the current one apart, again whenever the diff's DOM changes. */
function useMatchHighlights(query: string, caseSensitive: boolean, current: DiffMatch | null) {
  useEffect(() => {
    const registry = CSS.highlights
    if (!registry) {
      return
    }
    const clear = () => {
      registry.delete(ALL)
      registry.delete(CURRENT)
    }
    const scope = document.querySelector('[data-find-scope]')
    if (!(query && scope)) {
      return clear
    }
    let raf = 0
    const paint = () => {
      raf = 0
      const options = { caseSensitive }
      const cells = [...scope.querySelectorAll('td[data-row]')]
      registry.set(ALL, new Highlight(...cells.flatMap((cell) => rangesIn(cell, query, options))))
      const currentCell = current && cellOf(current)
      const range = currentCell && rangesIn(currentCell, query, options)[current.nth]
      if (range) {
        registry.set(CURRENT, new Highlight(range))
      } else {
        registry.delete(CURRENT)
      }
    }
    const schedule = () => {
      raf ||= requestAnimationFrame(paint)
    }
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

/** The matches of the query in every file's diff, searched once typing pauses; none while the bar is closed. */
function useMatches(files: readonly PullFile[], open: boolean, query: string, caseSensitive: boolean) {
  const parsed = useMemo(() => files.map((file) => ({ path: file.path, rows: parsePatch(file.patch ?? '') })), [files])
  const deferred = useDeferredQuery(query)
  const matches = useMemo(() => {
    if (!(open && deferred)) {
      return []
    }
    return searchDiffs(parsed, deferred, { caseSensitive })
  }, [open, parsed, deferred, caseSensitive])
  return { deferred, matches }
}

/** ⌘F opens the bar (and selects its text again); ⌘G and ⇧⌘G step through the matches while it is open. */
function useFindShortcuts(
  state: { go: (direction: 1 | -1) => void; open: boolean; showFiles: () => void },
  onOpen: () => void,
) {
  const latest = useRef({ ...state, onOpen })
  latest.current = { ...state, onOpen }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'f') {
        event.preventDefault()
        latest.current.showFiles()
        latest.current.onOpen()
      } else if (key === 'g' && latest.current.open) {
        event.preventDefault()
        latest.current.go(directionOf(event.shiftKey))
      }
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [])
}

/**
 * Find in the changed files (⌘F): searches every file's diff, not only the rendered ones, steps through the matches
 * (Enter, ⇧Enter, ⌘G, ⇧⌘G) and highlights those on screen with the CSS Custom Highlight API, so the diff's markup is
 * never touched.
 */
export function useDiffFind(opts: {
  files: readonly PullFile[]
  jump: (target: ScrollTarget) => void
  onFilesTab: boolean
  showFiles: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [index, setIndex] = useState<number | null>(null)
  const [focusTick, setFocusTick] = useState(0)

  const { deferred, matches } = useMatches(opts.files, open, query, caseSensitive)
  let current: DiffMatch | null = null
  if (index !== null) {
    current = matches[index] ?? null
  }

  // A new search starts over; the first step lands on the first match.
  // biome-ignore lint/correctness/useExhaustiveDependencies: matches is the trigger; new results reset the position.
  useEffect(() => setIndex(null), [matches])

  const { jump } = opts
  const go = (direction: 1 | -1) => {
    const next = stepMatch(index, matches.length, direction)
    if (next === null) {
      return
    }
    setIndex(next)
    const match = matches[next]
    if (match) {
      jump({ path: match.path, line: match.line, side: match.side })
    }
  }

  useFindShortcuts({ go, open, showFiles: opts.showFiles }, () => {
    setOpen(true)
    setFocusTick((tick) => tick + 1)
  })

  let highlighted = ''
  if (open && opts.onFilesTab) {
    highlighted = deferred
  }
  useMatchHighlights(highlighted, caseSensitive, current)

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
