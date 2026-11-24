import { findShortcutAction, type ShortcutActionId } from '@shared/shortcut-actions.util.ts'
import { runShortcut } from '../shortcuts/shortcut-runners.service.ts'
import type { PaletteAction } from './palette.types.ts'

/** Palette actions that do what these shortcuts do, under the same names. */
export function buildShortcutEntries(ids: readonly ShortcutActionId[]): PaletteAction[] {
  return ids.map((id) => ({ id, label: findShortcutAction(id).label, shortcut: id, run: () => runShortcut(id) }))
}
