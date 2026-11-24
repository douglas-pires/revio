import { type KeyboardEvent, type RefObject, useState } from 'react'
import { measureCaret } from './measure-caret.util.ts'
import type { MenuAnchor } from './suggestion-menu.component.tsx'
import type { Suggester, Suggestion } from './suggestions.types.ts'
import { findTrigger, type TypedTrigger } from './text-trigger.util.ts'

interface OpenMenu {
  trigger: TypedTrigger
  anchor: MenuAnchor
}

const STEPS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }
const PICK_KEYS = new Set(['Enter', 'Tab'])

/** Puts `text` in place of what was typed. Through the browser's own editing, so ⌘Z undoes it and React sees it. */
function replaceTyped(box: HTMLTextAreaElement, trigger: TypedTrigger, text: string) {
  box.focus()
  box.setSelectionRange(trigger.start, trigger.start + 1 + trigger.query.length)
  document.execCommand('insertText', false, text)
}

/** Suggestions for what is typed at the caret of a text box: which ones, which is highlighted, and the keys. */
export function useSuggestions(box: RefObject<HTMLTextAreaElement | null>, suggesters: readonly Suggester[]) {
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const [active, setActive] = useState(0)
  const close = () => setMenu(null)
  const findSuggester = (character: string | undefined) =>
    suggesters.find((suggester) => suggester.character === character)
  const suggestions = findSuggester(menu?.trigger.character)?.suggest(menu?.trigger.query ?? '') ?? []

  /** Looks at the caret again: call after the text changes. */
  const update = () => {
    const { current } = box
    const characters = suggesters.map(({ character }) => character)
    const trigger = current && findTrigger(current.value, current.selectionStart, characters)
    if (!trigger) {
      close()
      return
    }
    findSuggester(trigger.character)?.prepare?.()
    setActive(0)
    setMenu({ trigger, anchor: measureCaret(current, trigger.start) })
  }

  const pick = (suggestion: Suggestion | undefined) => {
    if (box.current && menu && suggestion) {
      replaceTyped(box.current, menu.trigger, `${suggestion.text} `)
    }
    close()
  }

  /** Handles the keys of an open menu; true when it did, and the text box should leave the key alone. */
  const handleKey = (event: KeyboardEvent): boolean => {
    if (!menu || suggestions.length === 0 || event.metaKey || event.ctrlKey || event.altKey) {
      return false
    }
    const step = STEPS[event.key]
    if (step !== undefined) {
      setActive((active + step + suggestions.length) % suggestions.length)
    } else if (PICK_KEYS.has(event.key)) {
      pick(suggestions[active])
    } else if (event.key === 'Escape') {
      close()
    } else {
      return false
    }
    event.preventDefault()
    return true
  }

  return { anchor: menu?.anchor ?? null, suggestions, active, update, close, pick, handleKey }
}
