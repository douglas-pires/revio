/** The most of the window one side panel may take, so the diff beside it stays usable. */
const MAX_PANEL_SHARE = 0.5

/** The narrowest a side panel may be dragged, unless it asks for another minimum. */
export const MIN_PANEL_WIDTH_PX = 200

/** Pixels one arrow-key press moves a panel's edge. */
export const KEYBOARD_STEP_PX = 16

/** `width` kept between the panel's minimum and half the window, in whole pixels. */
export function clampPanelWidth(width: number, windowWidth: number, minWidth = MIN_PANEL_WIDTH_PX): number {
  const maxWidth = Math.max(minWidth, Math.round(windowWidth * MAX_PANEL_SHARE))
  return Math.min(Math.max(Math.round(width), minWidth), maxWidth)
}

/**
 * The width after dragging the panel's free edge `dragged` pixels to the right. A panel on the left side of the
 * window grows as its right edge moves right; one on the right grows as its left edge moves left.
 */
export function dragPanelWidth(startWidth: number, dragged: number, edge: 'left' | 'right'): number {
  if (edge === 'right') {
    return startWidth + dragged
  }
  return startWidth - dragged
}

/** A stored width, or the default when there is none or it is not a positive number. */
export function parseStoredWidth(stored: string | null, fallback: number): number {
  const width = Number(stored)
  if (stored === null || !Number.isFinite(width) || width <= 0) {
    return fallback
  }
  return width
}
