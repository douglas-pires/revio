import type { ShortcutActionId } from '@shared/shortcut-actions.util.ts'

/** Something you can do from the palette. */
export interface PaletteAction {
  id: string
  label: string
  run: () => void
  /** The shortcut that does the same, to show its keys. */
  shortcut?: ShortcutActionId | undefined
}

/** A screen's actions, under its name. */
export interface PalettePage {
  name: string
  /** Its actions work on every screen, so they are listed after the current one's. */
  everywhere?: boolean
  actions: readonly PaletteAction[]
}

/** An action with the page it belongs to, as the palette lists it. */
export interface PaletteEntry extends PaletteAction {
  page: string
}
