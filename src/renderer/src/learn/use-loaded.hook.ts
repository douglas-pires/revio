import { useEffect, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'

/**
 * A value loaded when the screen opens and again whenever `load` changes: null until the first load, or why it could
 * not load. While a new load runs, the last value stays and `loading` is true.
 */
export function useLoaded<T>(load: () => Promise<T>) {
  const [value, setValue] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let current = true
    setLoading(true)
    load()
      .then((loaded) => current && setValue(loaded))
      .catch((failure: unknown) => current && setError(readErrorMessage(failure)))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [load])
  return { value, error, loading }
}
