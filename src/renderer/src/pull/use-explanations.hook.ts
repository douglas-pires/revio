import type { FileExplanationRecord } from '@shared/explanation.types.ts'
import { buildPullKey, type PullRef } from '@shared/pull.types.ts'
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'

/** Claude's explanations of the PR's files: written, being written, failed, shown, and which files are new to you. */
export interface Explanations {
  records: Readonly<Record<string, FileExplanationRecord>>
  /** What Claude is doing, by file being explained. */
  progress: Readonly<Record<string, string>>
  errors: Readonly<Record<string, string>>
  shown: ReadonlySet<string>
  unfamiliar: ReadonlySet<string>
  explain: (path: string) => void
  toggle: (path: string) => void
}

/** Null outside a PR. */
export const ExplanationsContext = createContext<Explanations | null>(null)

const without = <T>(record: Readonly<Record<string, T>>, key: string) =>
  Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key))

/** The PR's files in code you have not reviewed before, once your past reviews load. */
function useUnfamiliarFiles(pull: PullRef) {
  const [unfamiliar, setUnfamiliar] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    let current = true
    globalThis.revio
      .listUnfamiliarFiles(pull)
      .then((paths) => current && setUnfamiliar(new Set(paths)))
      // Without your past reviews nothing is marked.
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [pull])
  return unfamiliar
}

/** What Claude reports while it explains this PR's files. */
function useExplainProgress(pull: PullRef) {
  const [progress, setProgress] = useState<Record<string, string>>({})
  useEffect(() => {
    const key = buildPullKey(pull)
    return globalThis.revio.onEvent((event) => {
      if (event.type === 'explain-progress' && event.key === key) {
        setProgress((current) => ({ ...current, [event.path]: event.message }))
      }
    })
  }, [pull])
  return { progress, setProgress }
}

/** Explaining files on request, starting from the explanations saved for the PR. */
export function useExplanations(pull: PullRef, saved: Readonly<Record<string, FileExplanationRecord>> | undefined) {
  const [written, setWritten] = useState<Record<string, FileExplanationRecord>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set())
  const { progress, setProgress } = useExplainProgress(pull)
  const unfamiliar = useUnfamiliarFiles(pull)
  const explain = useCallback(
    (path: string) => {
      setShown((current) => new Set(current).add(path))
      setErrors((current) => without(current, path))
      setProgress((current) => ({ ...current, [path]: 'Starting…' }))
      globalThis.revio
        .explainFile(pull, path)
        .then((record) => setWritten((current) => ({ ...current, [path]: record })))
        .catch((failure: unknown) => setErrors((current) => ({ ...current, [path]: readErrorMessage(failure) })))
        .finally(() => setProgress((current) => without(current, path)))
    },
    [pull, setProgress],
  )
  const toggle = useCallback((path: string) => {
    setShown((current) => {
      const next = new Set(current)
      if (!next.delete(path)) {
        next.add(path)
      }
      return next
    })
  }, [])
  return useMemo<Explanations>(
    () => ({ records: { ...saved, ...written }, progress, errors, shown, unfamiliar, explain, toggle }),
    [saved, written, progress, errors, shown, unfamiliar, explain, toggle],
  )
}
