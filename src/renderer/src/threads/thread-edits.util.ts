import type { OpenThread, ThreadComment } from '@shared/thread.types.ts'

/** The thread list after your reply: the reply is the latest comment, so the thread now waits on others. */
export function applyReply(threads: readonly OpenThread[], threadId: string, reply: ThreadComment): OpenThread[] {
  return threads.map((thread) => {
    if (thread.id !== threadId) {
      return thread
    }
    return {
      ...thread,
      comments: [...thread.comments, reply],
      totalComments: thread.totalComments + 1,
      waitingOn: 'others',
      lastActivityAt: reply.createdAt,
    }
  })
}

/** A copy of the set with `id` added or removed. */
export function setMembership(set: ReadonlySet<string>, id: string, member: boolean): ReadonlySet<string> {
  const next = new Set(set)
  if (member) {
    next.add(id)
  } else {
    next.delete(id)
  }
  return next
}

/** Threads still open: resolved ones stay listed (to allow Undo) but no longer count. */
export const countWaitingOnYou = (threads: readonly OpenThread[], resolved: ReadonlySet<string>) =>
  threads.filter((thread) => thread.waitingOn === 'you' && !resolved.has(thread.id)).length
