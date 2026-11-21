import type { PullRef } from '@shared/pull.types.ts'
import type { PullTarget } from './navigation.types.ts'

/** Where the screen jumps to on arrival, which going back or forward should not repeat. */
function withoutTarget(r: Route): Route {
  if (r.view === 'pull' && r.target) {
    return { view: 'pull', pull: r.pull }
  }
  return r
}

/** A screen of the app. */
export type Route =
  | { view: 'inbox' }
  | { view: 'pull'; pull: PullRef; target?: PullTarget | undefined }
  | { view: 'guidelines'; repo?: string | undefined; path?: string | undefined }
  | { view: 'mentions' }
  | { view: 'my-pulls' }
  | { view: 'settings' }

/** The same screen, whatever it was opened to jump to. */
export const sameRoute = (a: Route, b: Route) => JSON.stringify(withoutTarget(a)) === JSON.stringify(withoutTarget(b))

export { withoutTarget }
