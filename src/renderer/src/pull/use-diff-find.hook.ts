import type { PullFile } from '@shared/pull.types.ts'
import { useEffect, useMemo, useState } from 'react'
import { useShortcut } from '../shortcuts/use-shortcut.hook.ts'
import { parsePatch } from './diff.util.ts'
import { type DiffMatch, searchDiffs, stepMatch } from './diff-search.util.ts'
import { findMatchCell, findRangesIn } from './find-highlights.util.ts'
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
    let frameRequest = 0
    const paint = () => {
      frameRequest = 0
      const options = { caseSensitive }
      const cells = [...scope.querySelectorAll('td[data-row]')]
      registry.set(ALL, new Highlight(...cells.flatMap((cell) => findRangesIn(cell, query, options))))
      const currentCell = current && findMatchCell(current)
      const range = currentCell && findRangesIn(currentCell, query, options)[current.nth]
      if (range) {
        registry.set(CURRENT, new Highlight(range))
      } else {
        registry.delete(CURRENT)
      }
    }
    const schedule = () => {
      frameRequest ||= requestAnimationFrame(paint)
    }
    paint()
    const observer = new MutationObserver(schedule)
    observer.observe(scope, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frameRequest)
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

/** One shortcut opens the bar (and selects its text again); two more step through the matches while it is open. */
function useFindShortcuts(
  state: { go: (direction: 1 | -1) => void; open: boolean; showFiles: () => void },
  onOpen: () => void,
) {
  const stepWhenOpen = (direction: 1 | -1) => {
    if (!state.open) {
      return null
    }
    return () => state.go(direction)
  }
  useShortcut('find', () => {
    state.showFiles()
    onOpen()
  })
  useShortcut('find-next', stepWhenOpen(1), { repeats: true })
  useShortcut('find-previous', stepWhenOpen(-1), { repeats: true })
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
