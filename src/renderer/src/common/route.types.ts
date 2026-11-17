import type { PullRef } from '@shared/pull.types'
import type { PullTarget } from './navigation.types'

/** A screen of the app. */
export type Route =
  | { view: 'inbox' }
  | { view: 'pull'; pull: PullRef; target?: PullTarget }
  | { view: 'guidelines'; repo?: string; path?: string }
  | { view: 'mentions' }
  | { view: 'settings' }

/** Where the screen jumps to on arrival, which going back or forward should not repeat. */
const withoutTarget = (r: Route): Route => (r.view === 'pull' && r.target ? { view: 'pull', pull: r.pull } : r)

/** The same screen, whatever it was opened to jump to. */
export const sameRoute = (a: Route, b: Route) => JSON.stringify(withoutTarget(a)) === JSON.stringify(withoutTarget(b))

export { withoutTarget }
