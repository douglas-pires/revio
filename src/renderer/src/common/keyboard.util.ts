import type { KeyboardEvent } from 'react'

const TEXT_FIELD_TAGS = /^(?:INPUT|TEXTAREA|SELECT)$/u

/** True when a key press lands in a text field, so single-letter shortcuts should stay out of the way. */
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || TEXT_FIELD_TAGS.test(target.tagName))

/**
 * A keydown handler that runs `activate` on Enter or Space, as a button does. For clickable elements that cannot be
 * a <button> (one holding other buttons); ignores presses that started on a control inside it.
 */
export function onActivateKey(activate: () => void) {
  return (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
      return
    }
    event.preventDefault()
    activate()
  }
}
