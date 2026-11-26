import { COMMENT_KINDS, type CommentKind } from '@shared/comment-kinds.util.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { z } from 'zod'
import { requestJson } from '../claude/claude-json.service.ts'

/** Comments sorted per request, and per run (the rest wait for the next run). */
const BATCH_SIZE = 60
const MAX_PER_RUN = 360
const COMMENT_CHARS = 400
const MAX_SORT_TOKENS = 6000

const SortSchema = z.object({
  comments: z.array(
    z.object({
      index: z.number().int(),
      kinds: z.array(z.enum(COMMENT_KINDS)).describe('1 or 2 kinds, the main one first.'),
    }),
  ),
})

const SYSTEM = `You sort a code reviewer's past review comments by what each is about, so they can see their habits.
Kinds: correctness (logic, edge cases, bugs), error-handling, tests, security, performance, design (structure,
abstractions, responsibilities), naming, readability, style (formatting, lint-level), docs (comments, READMEs),
question (asks rather than states), praise. Give each comment its 1 or 2 best kinds, the main one first.`

interface Unsorted {
  url: string
  path: string
  body: string
}

export function buildSortPrompt(batch: readonly Unsorted[]) {
  const listed = batch
    .map(
      (comment, index) =>
        `<comment index="${index}" file="${comment.path}">\n${comment.body.slice(0, COMMENT_CHARS)}\n</comment>`,
    )
    .join('\n')
  return `${listed}\n\nSort every comment, by index, using the required JSON format.`
}

async function sortBatch(batch: readonly Unsorted[]) {
  const { answer } = await requestJson({
    schema: SortSchema,
    system: SYSTEM,
    prompt: buildSortPrompt(batch),
    maxTokens: MAX_SORT_TOKENS,
    effort: 'low',
    noun: 'sorting',
    onProgress: () => undefined,
  })
  const sorted: Record<string, CommentKind[]> = {}
  for (const { index, kinds } of answer.comments) {
    const comment = batch[index]
    if (comment && kinds.length > 0) {
      sorted[comment.url] = kinds
    }
  }
  return sorted
}

/** Sorts the comments not sorted yet, newest first and up to a run's worth, saving each batch as it is done. */
export async function sortNewComments(
  reviews: readonly PastReview[],
  known: Readonly<Record<string, CommentKind[]>>,
  save: (kinds: Record<string, CommentKind[]>) => void,
) {
  const unsorted = reviews
    .flatMap((review) => review.comments)
    .filter((comment) => !(comment.url in known))
    .slice(0, MAX_PER_RUN)
  // One batch at a time: each is saved before the next, so a failure keeps what was sorted.
  for (let start = 0; start < unsorted.length; start += BATCH_SIZE) {
    save(await sortBatch(unsorted.slice(start, start + BATCH_SIZE)))
  }
}
