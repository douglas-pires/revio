import type { PullRef } from '@shared/pull.types.ts'
import type { PullTarget } from './navigation.types.ts'

/** Where the screen jumps to on arrival, which going back or forward should not repeat. */
function dropTarget(route: Route): Route {
  if (route.view === 'pull' && route.target) {
    return { view: 'pull', pull: route.pull }
  }
  return route
}

/** A screen of the app. */
export type Route =
  | { view: 'inbox' }
  | { view: 'pull'; pull: PullRef; target?: PullTarget | undefined }
  | { view: 'guidelines'; repo?: string | undefined; path?: string | undefined }
  | { view: 'mentions' }
  | { view: 'my-pulls' }
  | { view: 'log' }
  | { view: 'settings' }

/** The same screen, whatever it was opened to jump to. */
export const sameRoute = (left: Route, right: Route) =>
  JSON.stringify(dropTarget(left)) === JSON.stringify(dropTarget(right))

export { dropTarget }
