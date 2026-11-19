import { type RefObject, useEffect } from 'react'
import { isTyping } from '../common/keyboard.util.ts'

/** "/" focuses the search box, as on GitHub. */
export function useSlashToFocus(input: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) {
        return
      }
      e.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [input])
}
