import type { DraftComment } from '@shared/pull.types.ts'

function toLineComment(draft: DraftComment & { line: number }): ReviewLineComment {
  const comment: ReviewLineComment = { path: draft.path, body: draft.body, line: draft.line, side: draft.side }
  if (draft.startLine && draft.startLine !== draft.line) {
    comment.start_line = draft.startLine
    comment.start_side = draft.side
  }
  return comment
}

/** A new line comment in the shape GitHub's "create review" call takes. */
interface ReviewLineComment {
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
  for (const draft of drafts) {
    if (draft.inReplyTo) {
      plan.replies.push({ commentId: draft.inReplyTo, body: draft.body })
    } else if (draft.line === null) {
      plan.fileComments.push({ path: draft.path, body: draft.body })
    } else {
      plan.lineComments.push(toLineComment({ ...draft, line: draft.line }))
    }
  }
  return plan
}
