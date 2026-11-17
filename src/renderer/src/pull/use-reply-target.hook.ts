import { createContext, useContext, useEffect } from 'react'

/** The review comment whose thread should open its reply box once, e.g. after following a mention to it. */
export interface ReplyTarget {
  commentId: number | null
  consume: () => void
}

export const ReplyTargetContext = createContext<ReplyTarget>({ commentId: null, consume: () => {} })

/** Calls `open` once when this thread holds the reply target. */
export function useOpenReplyIfTarget(commentIds: readonly number[], open: () => void) {
  const target = useContext(ReplyTargetContext)
  const hit = target.commentId != null && commentIds.includes(target.commentId)
  useEffect(() => {
    if (!hit) return
    open()
    target.consume()
  }, [hit, open, target])
}
