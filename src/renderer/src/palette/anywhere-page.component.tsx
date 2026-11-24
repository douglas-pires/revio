import type { Route } from '../common/route.types.ts'
import { buildShortcutEntries } from './shortcut-entries.util.ts'
import { usePalettePage } from './use-palette-page.hook.ts'

const SCREENS = [
  { view: 'inbox', label: 'Go to the inbox' },
  { view: 'my-pulls', label: 'Go to my PRs' },
  { view: 'mentions', label: 'Go to mentions' },
  { view: 'guidelines', label: 'Go to the review guides' },
  { view: 'whats-new', label: 'What’s new in Revio' },
] as const

/** The palette's actions that work on every screen: going to the others, settings and the shortcuts. */
export function AnywherePage({ go }: { go: (route: Route) => void }) {
  usePalettePage({
    name: 'Anywhere',
    everywhere: true,
    actions: [
      ...SCREENS.map(({ view, label }) => ({ id: view, label, run: () => go({ view }) })),
      ...buildShortcutEntries(['settings', 'show-shortcuts']),
    ],
  })
  return null
}
