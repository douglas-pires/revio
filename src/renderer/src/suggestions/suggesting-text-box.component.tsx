import { type ComponentProps, useId, useRef } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { MentionHighlight } from '../mentionables/mention-highlight.component.tsx'
import { SuggestionMenu } from './suggestion-menu.component.tsx'
import type { Suggester } from './suggestions.types.ts'
import { useSuggestions } from './use-suggestions.hook.ts'

interface SuggestingTextBoxProps extends ComponentProps<'textarea'> {
  value: string
  suggesters: readonly Suggester[]
}

/**
 * A text box that suggests what to write as you type a suggester's character (arrows, then Enter or Tab), and colours
 * mentions.
 */
export function SuggestingTextBox(props: SuggestingTextBoxProps) {
  const { suggesters, className, onChange, onKeyDown, onBlur, ...rest } = props
  const box = useRef<HTMLTextAreaElement>(null)
  const highlight = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const menu = useSuggestions(box, suggesters)
  const open = menu.anchor !== null && menu.suggestions.length > 0
  return (
    <div className="relative">
      <MentionHighlight layer={highlight} text={props.value} className={className} />
      <textarea
        {...rest}
        ref={box}
        className={joinClassNames(
          className,
          'relative block bg-transparent text-transparent caret-fg [scrollbar-gutter:stable]',
        )}
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
        onScroll={(event) => {
          highlight.current?.scrollTo({ top: event.currentTarget.scrollTop })
          menu.close()
        }}
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
    </div>
  )
}
