import type { ListView, Route } from './route.types.ts'

const LIST_VIEWS: readonly string[] = ['inbox', 'my-pulls', 'mentions'] satisfies ListView[]

/** The list a PR opened from `route` belongs to: that list, or for a PR opened from another PR, the same list. */
export function readListOrigin(route: Route): ListView | undefined {
  if (route.view === 'pull') {
    return route.from
  }
  if (LIST_VIEWS.includes(route.view)) {
    return route.view as ListView
  }
  return undefined
}

/** The rail item to highlight: the screen itself, or for a PR, the list it was opened from (the inbox by default). */
export function pickRailView(route: Route) {
  if (route.view === 'pull') {
    return route.from ?? 'inbox'
  }
  return route.view
}
