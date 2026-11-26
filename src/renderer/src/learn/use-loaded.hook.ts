import { useEffect, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'

/** A value loaded once when the screen opens: null while loading, or why it could not load. */
export function useLoaded<T>(load: () => Promise<T>) {
  const [value, setValue] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    load()
      .then((loaded) => current && setValue(loaded))
      .catch((failure: unknown) => current && setError(readErrorMessage(failure)))
    return () => {
      current = false
    }
  }, [load])
  return { value, error }
}
