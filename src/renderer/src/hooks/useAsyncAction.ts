import { useCallback, useState } from 'react'
import { errorMessage } from '../lib/format'

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
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, error, run }
}
