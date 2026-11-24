import {
  findActionConflict,
  overrideShortcut,
  resolveShortcuts,
  type ShortcutActionId,
  type ShortcutOverrides,
} from '@shared/shortcut-actions.util.ts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ShortcutsApi } from './shortcuts.context.ts'

/** The shortcuts from the settings, for `ShortcutsContext`: read once, then changed here and saved. */
export function useShortcutSettings(): ShortcutsApi {
  const [overrides, setOverrides] = useState<ShortcutOverrides>({})
  useEffect(() => {
    globalThis.revio.getSettings().then((settings) => setOverrides(settings.shortcuts))
  }, [])
  const store = useCallback((next: ShortcutOverrides) => {
    setOverrides(next)
    globalThis.revio.updateSettings({ shortcuts: next })
  }, [])
  return useMemo(() => {
    const shortcuts = resolveShortcuts(overrides)
    return {
      shortcuts,
      save: (id: ShortcutActionId, shortcut: string) => store(overrideShortcut(overrides, id, shortcut)),
      resetAll: () => store({}),
      findConflict: (id: ShortcutActionId, shortcut: string) => findActionConflict(id, shortcut, shortcuts),
    }
  }, [overrides, store])
}
