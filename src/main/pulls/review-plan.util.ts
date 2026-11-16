import type { DraftComment } from '@shared/pull.types'

/** A new line comment in the shape GitHub's "create review" call takes. */
export interface ReviewLineComment {
  path: string
  body: string
  line: number
  side: DraftComment['side']
  start_line?: number
  start_side?: DraftComment['side']
}

export interface ReviewPlan {
  /** Replies to existing threads: GitHub does not take them in a review payload, so they post first. */
  replies: { commentId: number; body: string }[]
  lineComments: ReviewLineComment[]
  /** Comments on whole files: the "create review" call cannot carry them, so they join the review as threads. */
  fileComments: { path: string; body: string }[]
}

/** Sorts pending drafts into what each GitHub call needs. */
export function planReview(drafts: readonly DraftComment[]): ReviewPlan {
  const plan: ReviewPlan = { replies: [], lineComments: [], fileComments: [] }
  for (const d of drafts) {
    if (d.inReplyTo) plan.replies.push({ commentId: d.inReplyTo, body: d.body })
    else if (d.line == null) plan.fileComments.push({ path: d.path, body: d.body })
    else plan.lineComments.push(toLineComment({ ...d, line: d.line }))
  }
  return plan
}

function toLineComment(d: DraftComment & { line: number }): ReviewLineComment {
  const range = d.startLine && d.startLine !== d.line ? { start_line: d.startLine, start_side: d.side } : {}
  return { path: d.path, body: d.body, line: d.line, side: d.side, ...range }
}
