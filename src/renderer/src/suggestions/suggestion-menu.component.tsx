import { useLayoutEffect, useRef } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import type { Suggestion } from './suggestions.types.ts'

/** Space between the line being typed and the menu, and between the menu and the window's edge. */
const GAP_PX = 4

/** The line the menu belongs to, on screen. */
export interface MenuAnchor {
  left: number
  top: number
  bottom: number
}

/** Under the line when it fits in the window, else above it; never past the right edge. */
function placeMenu(menu: HTMLElement, anchor: MenuAnchor) {
  const { width, height } = menu.getBoundingClientRect()
  let top = anchor.bottom + GAP_PX
  if (top + height > window.innerHeight - GAP_PX) {
    top = anchor.top - height - GAP_PX
  }
  menu.style.top = `${top}px`
  menu.style.left = `${Math.max(GAP_PX, Math.min(anchor.left, window.innerWidth - width - GAP_PX))}px`
}

/**
 * What a text box suggests, at the caret. A popover, so it sits over everything: neither a file's card nor a panel
 * cuts it off. The text box keeps the focus and handles the keys.
 */
export function SuggestionMenu(props: {
  id: string
  anchor: MenuAnchor
  suggestions: readonly Suggestion[]
  active: number
  onPick: (suggestion: Suggestion) => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  const { anchor, suggestions } = props
  // biome-ignore lint/correctness/useExhaustiveDependencies: other suggestions change the menu's size, so it is placed again.
  useLayoutEffect(() => {
    if (menu.current) {
      if (!menu.current.matches(':popover-open')) {
        menu.current.showPopover()
      }
      placeMenu(menu.current, anchor)
    }
  }, [anchor, suggestions])
  return (
    <div
      ref={menu}
      id={props.id}
      popover="manual"
      role="listbox"
      aria-label="Suggestions"
      className="fixed inset-auto m-0 max-h-72 min-w-48 overflow-y-auto rounded-md border border-line bg-panel p-0 py-1 text-fg shadow-lg"
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={suggestion.key}
          role="option"
          tabIndex={-1}
          aria-selected={index === props.active}
          className={joinClassNames(
            'flex cursor-default items-center gap-2 px-2.5 py-1 text-[12.5px]',
            index === props.active && 'bg-accent/15',
            index !== props.active && 'hover:bg-hover',
          )}
          // On mouse down, so the text box keeps the focus.
          onMouseDown={(event) => {
            event.preventDefault()
            props.onPick(suggestion)
          }}
        >
          {suggestion.picture}
          <span className="truncate">{suggestion.label}</span>
          {Boolean(suggestion.detail) && <span className="truncate text-muted">{suggestion.detail}</span>}
        </div>
      ))}
    </div>
  )
}
