import { type RefObject, useEffect } from 'react'
import { isTyping } from '../common/keyboard.util.ts'

/** "/" focuses the search box, as on GitHub. */
export function useSlashToFocus(input: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) {
        return
      }
      event.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [input])
}
