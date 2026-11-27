import { formatShortcut } from '@shared/shortcut.util.ts'
import { findShortcutAction, type ShortcutActionId } from '@shared/shortcut-actions.util.ts'
import { type ReactNode, useEffect, useRef } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { useShortcuts } from './shortcuts.context.ts'

/** How long the pointer rests on the button before the hint shows. */
const SHOW_DELAY_MS = 350

/** The hint showing now: showing another, or scrolling anything, closes it. */
let openHint: HTMLElement | null = null

function closeOpenHint() {
  if (openHint?.matches(':popover-open')) {
    openHint.hidePopover()
  }
  openHint = null
}

/** Where the hint sits against the button; it flips when there is no room. */
const PLACES = {
  bottom: '[position-area:bottom] mt-1',
  top: '[position-area:top] mb-1',
  right: '[position-area:right] ml-2',
} as const

/** The keys as shown, or how to get some when the shortcut is turned off. */
function KeysOrNone({ shortcut }: { shortcut: string }) {
  if (!shortcut) {
    return <span className="text-muted">no shortcut · set one in Settings › Shortcuts</span>
  }
  return <kbd className="kbd">{formatShortcut(shortcut)}</kbd>
}

/**
 * A button with a shortcut, and a hint naming what it does and its keys (as you set them) when the pointer rests on
 * it or it takes the keyboard focus. The hint lives in the top layer, so no scrolling box or card clips it.
 */
export function ShortcutHint(props: {
  action: ShortcutActionId
  /** What the button does, when it says more than the action's own label. */
  description?: string
  place?: keyof typeof PLACES
  className?: string
  children: ReactNode
}) {
  const { shortcuts } = useShortcuts()
  const anchor = useRef<HTMLSpanElement>(null)
  const hint = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hide = () => {
    clearTimeout(timer.current)
    if (openHint === hint.current) {
      closeOpenHint()
    }
  }
  const show = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const element = hint.current
      if (!(anchor.current?.isConnected && element) || openHint === element) {
        return
      }
      closeOpenHint()
      element.showPopover({ source: anchor.current })
      openHint = element
    }, SHOW_DELAY_MS)
  }
  useEffect(() => {
    // Scrolling moves the button from under the pointer without a leave event; the hint goes with it.
    const closeOnScroll = () => {
      clearTimeout(timer.current)
      if (openHint === hint.current) {
        closeOpenHint()
      }
    }
    globalThis.addEventListener('scroll', closeOnScroll, { capture: true, passive: true })
    return () => {
      clearTimeout(timer.current)
      globalThis.removeEventListener('scroll', closeOnScroll, { capture: true })
      if (openHint === hint.current) {
        closeOpenHint()
      }
    }
  }, [])
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the wrapper only watches the pointer and focus to show the hint; the button inside is the control.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same; the handlers observe, they do not make the wrapper a control.
    <span
      ref={anchor}
      className={joinClassNames('inline-flex', props.className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={hide}
    >
      {props.children}
      <div
        ref={hint}
        popover="manual"
        role="tooltip"
        // No display class on the popover itself: it would override the browser hiding it while closed.
        className={joinClassNames(
          'pointer-events-none m-0 rounded-md border border-line bg-panel px-2 py-1 text-[11.5px] whitespace-nowrap text-fg shadow-lg [inset:auto] [position-try-fallbacks:flip-block,flip-inline]',
          PLACES[props.place ?? 'bottom'],
        )}
      >
        <span className="flex items-center gap-2">
          <span>{props.description ?? findShortcutAction(props.action).label}</span>
          <KeysOrNone shortcut={shortcuts[props.action]} />
        </span>
      </div>
    </span>
  )
}
