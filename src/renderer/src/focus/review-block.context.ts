import { createContext, useContext } from 'react'
import type { ReviewBlockState } from './use-review-block.hook.ts'

/** The review block in progress, for the screens that hide things while you focus. */
export const ReviewBlockContext = createContext<ReviewBlockState | null>(null)

/** Whether a review block is on, so what distracts from reviewing can step aside. */
export function useFocused() {
  return useContext(ReviewBlockContext)?.focused ?? false
}
