import type { AskActivity } from '@shared/claude.types.ts'
import { MS_PER_SECOND } from '@shared/time.util.ts'

/** What Claude has done on the question being answered: the steps so far, its reasoning, and when it began. */
export interface AskProgress {
  /** The chat it belongs to: the panel shows it only there. */
  threadId: string
  steps: string[]
  thinking: string
  startedAt: number
  /** Set once the answer is in: the time worked stops there. */
  finishedAt?: number | undefined
}

export function startProgress(threadId: string, now: number): AskProgress {
  return { threadId, steps: [], thinking: '', startedAt: now }
}

/** The progress once the answer is in, kept to show how the answer came about. */
export function finishedProgress(progress: AskProgress, now: number): AskProgress {
  return { ...progress, finishedAt: now }
}

/** The progress after one more activity: a new step, or more reasoning. */
export function withActivity(progress: AskProgress, activity: AskActivity): AskProgress {
  if (activity.kind === 'step') {
    return { ...progress, steps: [...progress.steps, activity.label] }
  }
  return { ...progress, thinking: progress.thinking + activity.text }
}

/** Whole seconds worked on the question (so far, or until the answer was in), at least 1. */
export function secondsSince(progress: AskProgress, now: number): number {
  const end = progress.finishedAt ?? now
  return Math.max(1, Math.round((end - progress.startedAt) / MS_PER_SECOND))
}
