import { useCallback, useState } from 'react'
import { errorMessage } from './format.util.ts'

/** Busy and error state around an async action. `run` resolves true when the action succeeded. */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (failure) {
      setError(errorMessage(failure))
      return false
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, error, run }
}
