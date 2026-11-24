import { type ComponentProps, useId, useRef } from 'react'
import { SuggestionMenu } from './suggestion-menu.component.tsx'
import type { Suggester } from './suggestions.types.ts'
import { useSuggestions } from './use-suggestions.hook.ts'

interface SuggestingTextBoxProps extends ComponentProps<'textarea'> {
  suggesters: readonly Suggester[]
}

/** A text box that suggests what to write as you type a suggester's character: arrows, then Enter or Tab. */
export function SuggestingTextBox({ suggesters, onChange, onKeyDown, onBlur, ...rest }: SuggestingTextBoxProps) {
  const box = useRef<HTMLTextAreaElement>(null)
  const menuId = useId()
  const menu = useSuggestions(box, suggesters)
  const open = menu.anchor !== null && menu.suggestions.length > 0
  return (
    <>
      <textarea
        {...rest}
        ref={box}
        aria-controls={menuId}
        aria-autocomplete="list"
        onChange={(event) => {
          onChange?.(event)
          menu.update()
        }}
        onKeyDown={(event) => {
          if (!menu.handleKey(event)) {
            onKeyDown?.(event)
          }
        }}
        onBlur={(event) => {
          menu.close()
          onBlur?.(event)
        }}
        onScroll={menu.close}
        onClick={menu.close}
      />
      {menu.anchor !== null && open && (
        <SuggestionMenu
          id={menuId}
          anchor={menu.anchor}
          suggestions={menu.suggestions}
          active={menu.active}
          onPick={menu.pick}
        />
      )}
    </>
  )
}
