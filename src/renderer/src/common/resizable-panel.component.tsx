import { type KeyboardEvent, type PointerEvent, type ReactNode, useCallback, useRef, useState } from 'react'
import { joinClassNames } from './format.util.ts'
import {
  clampPanelWidth,
  dragPanelWidth,
  KEYBOARD_STEP_PX,
  MIN_PANEL_WIDTH_PX,
  parseStoredWidth,
} from './panel-width.util.ts'

const storageKey = (id: string) => `revio.panelWidth.${id}`

type PanelEdge = 'left' | 'right'

/** Where the drag strip sits: straddling the panel's free edge. */
const EDGE_POSITION: Record<PanelEdge, string> = { left: '-left-1', right: '-right-1' }

/** How far the edge moves for an arrow key, before `dragPanelWidth` turns it into a width. */
const ARROW_MOVES: Record<string, number> = { ArrowLeft: -KEYBOARD_STEP_PX, ArrowRight: KEYBOARD_STEP_PX }

function readWidth(id: string, fallback: number): number {
  try {
    return parseStoredWidth(localStorage.getItem(storageKey(id)), fallback)
  } catch {
    return fallback
  }
}

function storeWidth(id: string, width: number) {
  try {
    localStorage.setItem(storageKey(id), String(width))
  } catch {
    // A convenience only: the panel opens at its default width next time.
  }
}

/** A panel's width, remembered per panel; `resize` clamps it to the window and `save` keeps it for next time. */
function usePanelWidth(id: string, defaultWidth: number, minWidth: number) {
  const [width, setWidth] = useState(() => readWidth(id, defaultWidth))
  const clamp = useCallback((next: number) => clampPanelWidth(next, globalThis.innerWidth, minWidth), [minWidth])
  const resize = useCallback((next: number) => setWidth(clamp(next)), [clamp])
  const save = useCallback((next: number) => storeWidth(id, clamp(next)), [id, clamp])
  return { width: clamp(width), resize, save }
}

/**
 * The panel's free edge: drag it, or focus it and press ← / →, to change the width; double-click returns to the
 * default width.
 */
function ResizeEdge(props: {
  edge: PanelEdge
  width: number
  minWidth: number
  defaultWidth: number
  label: string
  onResize: (width: number) => void
  onDone: (width: number) => void
}) {
  const drag = useRef<{ startX: number; startWidth: number; width: number } | null>(null)
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startX: event.clientX, startWidth: props.width, width: props.width }
  }
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return
    }
    drag.current.width = dragPanelWidth(drag.current.startWidth, event.clientX - drag.current.startX, props.edge)
    props.onResize(drag.current.width)
  }
  const endDrag = () => {
    if (drag.current) {
      props.onDone(drag.current.width)
    }
    drag.current = null
  }
  const resizeWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const moved = ARROW_MOVES[event.key]
    if (moved === undefined) {
      return
    }
    event.preventDefault()
    const next = dragPanelWidth(props.width, moved, props.edge)
    props.onResize(next)
    props.onDone(next)
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be dragged or focused; this is a window splitter.
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={props.label}
      aria-valuenow={props.width}
      aria-valuemin={props.minWidth}
      tabIndex={0}
      title="Drag to resize · double-click for the default width"
      className={joinClassNames(
        'absolute inset-y-0 z-20 w-1.5 cursor-col-resize outline-none hover:bg-accent/40 focus-visible:bg-accent/60',
        EDGE_POSITION[props.edge],
      )}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => {
        props.onResize(props.defaultWidth)
        props.onDone(props.defaultWidth)
      }}
      onKeyDown={resizeWithKeys}
    />
  )
}

/**
 * A side panel (`<aside>`) you can widen or narrow by dragging its inner edge. Each panel's width is remembered by
 * `name`, at most half the window and at least `minWidth`.
 */
export function ResizablePanel(props: {
  /** Which panel this is, to remember its width by. */
  name: string
  /** The edge that faces the content: 'right' for a panel on the left of the window, 'left' for one on the right. */
  edge: PanelEdge
  defaultWidth: number
  minWidth?: number
  /** What the resize edge is called for screen readers, e.g. "Resize the files list". */
  label: string
  className?: string
  children: ReactNode
}) {
  const minWidth = props.minWidth ?? MIN_PANEL_WIDTH_PX
  const { width, resize, save } = usePanelWidth(props.name, props.defaultWidth, minWidth)
  return (
    <aside
      data-panel={props.name}
      className={joinClassNames('relative shrink-0', props.className)}
      // biome-ignore lint/style/noInlineStyles: the width you dragged the panel to.
      style={{ width }}
    >
      {props.children}
      <ResizeEdge
        edge={props.edge}
        width={width}
        minWidth={minWidth}
        defaultWidth={props.defaultWidth}
        label={props.label}
        onResize={resize}
        onDone={save}
      />
    </aside>
  )
}
