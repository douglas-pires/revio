import { resolveShortcuts, type ShortcutActionId, type Shortcuts } from '@shared/shortcut-actions.util.ts'
import { createContext, useContext } from 'react'

/** Every action's keys, and changing them. */
export interface ShortcutsApi {
  shortcuts: Shortcuts
  save: (id: ShortcutActionId, shortcut: string) => void
  resetAll: () => void
  /** What giving `shortcut` to the action would clash with, or null. */
  findConflict: (id: ShortcutActionId, shortcut: string) => string | null
}

export const ShortcutsContext = createContext<ShortcutsApi>({
  shortcuts: resolveShortcuts({}),
  save: () => undefined,
  resetAll: () => undefined,
  findConflict: () => null,
})

export const useShortcuts = () => useContext(ShortcutsContext)
