import type { OpenThread, ThreadComment } from '@shared/thread.types'

/** The thread list after your reply: the reply is the latest comment, so the thread now waits on others. */
export function applyReply(threads: readonly OpenThread[], threadId: string, reply: ThreadComment): OpenThread[] {
  return threads.map((t) =>
    t.id === threadId
      ? { ...t, comments: [...t.comments, reply], totalComments: t.totalComments + 1, waitingOn: 'others', lastActivityAt: reply.createdAt }
      : t,
  )
}

/** A copy of the set with `id` added or removed. */
export function setMembership(set: ReadonlySet<string>, id: string, member: boolean): ReadonlySet<string> {
  const next = new Set(set)
  if (member) next.add(id)
  else next.delete(id)
  return next
}

/** Threads still open: resolved ones stay listed (to allow Undo) but no longer count. */
export const countWaitingOnYou = (threads: readonly OpenThread[], resolved: ReadonlySet<string>) =>
  threads.filter((t) => t.waitingOn === 'you' && !resolved.has(t.id)).length
