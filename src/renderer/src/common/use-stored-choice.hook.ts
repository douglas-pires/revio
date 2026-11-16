import { useCallback, useState } from 'react'

function readStored<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return choices.find((c) => c === stored) ?? fallback
  } catch {
    return fallback
  }
}

/** A small UI choice remembered per viewer in localStorage (a convenience: storage failures are ignored). */
export function useStoredChoice<T extends string>(key: string, choices: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, choices, fallback))
  const change = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, next)
      } catch {
        /* private mode or blocked storage: keep the in-memory choice */
      }
    },
    [key],
  )
  return [value, change] as const
}
