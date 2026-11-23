import { describe, expect, it } from 'vitest'
import { clampPanelWidth, dragPanelWidth, MIN_PANEL_WIDTH_PX, parseStoredWidth } from './panel-width.util.ts'

describe('clampPanelWidth', () => {
  it('keeps the width between the minimum and half the window', () => {
    expect(clampPanelWidth(50, 1600)).toBe(MIN_PANEL_WIDTH_PX)
    expect(clampPanelWidth(1200, 1600)).toBe(800)
    expect(clampPanelWidth(440.6, 1600)).toBe(441)
    expect(clampPanelWidth(250, 1600, 300)).toBe(300)
  })

  it('never goes under the minimum, even in a narrow window', () => {
    expect(clampPanelWidth(600, 300)).toBe(MIN_PANEL_WIDTH_PX)
  })
})

describe('dragPanelWidth', () => {
  it('grows a left panel as its right edge moves right, and a right panel as its left edge moves left', () => {
    expect(dragPanelWidth(300, 40, 'right')).toBe(340)
    expect(dragPanelWidth(300, 40, 'left')).toBe(260)
    expect(dragPanelWidth(300, -40, 'left')).toBe(340)
  })
})

describe('parseStoredWidth', () => {
  it('reads a stored width and falls back on anything else', () => {
    expect(parseStoredWidth('360', 440)).toBe(360)
    expect(parseStoredWidth(null, 440)).toBe(440)
    expect(parseStoredWidth('wide', 440)).toBe(440)
    expect(parseStoredWidth('-5', 440)).toBe(440)
  })
})
