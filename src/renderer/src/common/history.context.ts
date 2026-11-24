import { createContext } from 'react'
import type { Route } from './route.types.ts'

/** Back and forward through the screens you visited, as the app shell keeps them. */
export interface HistoryControls {
  canGoBack: boolean
  canGoForward: boolean
  back: () => void
  forward: () => void
  /** Goes to a screen. */
  go: (route: Route) => void
}

/** Provided by the app shell, so every screen header shows the same arrows without passing them down. */
export const HistoryContext = createContext<HistoryControls | null>(null)
