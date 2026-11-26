import type { Octokit } from '@octokit/rest'
import type { CatchTheme, RaisedPoint, SharedReview } from '@shared/learn.types.ts'
import { isPresent } from '@shared/presence.util.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { z } from 'zod'
import { requestJson } from '../claude/claude-json.service.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { compareReviewers, type PullPoints } from './compare-reviewers.util.ts'

/** The PRs compared, most recently reviewed first. */
const MAX_PULLS = 40
/** PRs read per GitHub request, and threads read per PR. */
const BATCH_SIZE = 10
const THREADS_PER_PULL = 100
/** Points sent to Claude, and characters of each. */
const MAX_POINTS_SUMMARISED = 120
const POINT_CHARS = 500

interface RawThreadComment {
  author: { login: string } | null
  path: string
  line: number | null
  originalLine: number | null
  body: string
  url: string
}

interface RawPull {
  number: number
  title: string
  url: string
  author: { login: string } | null
  reviewThreads: { nodes: ({ comments: { nodes: (RawThreadComment | null)[] } } | null)[] }
}

/** The PRs you reviewed, once each, most recent first. */
function listReviewedPulls(reviews: readonly PastReview[]) {
  const seen = new Map<string, PastReview>()
  for (const review of reviews) {
    const key = `${review.repo}#${review.number}`
    if (!seen.has(key)) {
      seen.set(key, review)
    }
  }
  return [...seen.values()].slice(0, MAX_PULLS)
}

/** The point a thread raises: its first comment. */
function toPoint(comment: RawThreadComment | null | undefined): RaisedPoint | null {
  if (!comment) {
    return null
  }
  return {
    author: comment.author?.login ?? 'ghost',
    path: comment.path,
    line: comment.line ?? comment.originalLine,
    body: comment.body,
    url: comment.url,
  }
}

async function fetchBatch(octokit: Octokit, batch: readonly PastReview[]): Promise<PullPoints[]> {
  const fields = batch.map((review, index) => {
    const { owner, repo } = splitRepo(review.repo)
    return `p${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
      pullRequest(number: ${review.number}) { number title url author { login }
        reviewThreads(first: ${THREADS_PER_PULL}) { nodes { comments(first: 1) {
          nodes { author { login } path line originalLine body url }
        } } }
      }
    }`
  })
  const data = await octokit.graphql<Record<string, { pullRequest: RawPull | null } | null>>(
    `query { ${fields.join('\n')} }`,
  )
  return batch.flatMap((review, index) => {
    const pull = data[`p${index}`]?.pullRequest
    if (!pull) {
      return []
    }
    return [
      {
        repo: review.repo,
        number: pull.number,
        title: pull.title,
        url: pull.url,
        author: pull.author?.login ?? 'ghost',
        points: pull.reviewThreads.nodes.map((thread) => toPoint(thread?.comments.nodes[0])).filter(isPresent),
      },
    ]
  })
}

/** The PRs you reviewed in the last year that others reviewed too, with what they raised that you did not. */
export async function findSharedReviews(
  octokit: Octokit,
  viewer: string,
  reviews: readonly PastReview[],
): Promise<SharedReview[]> {
  const pulls = listReviewedPulls(reviews)
  const points: PullPoints[] = []
  // One batch at a time, to stay well inside GitHub's limits on concurrent requests.
  for (let start = 0; start < pulls.length; start += BATCH_SIZE) {
    points.push(...(await fetchBatch(octokit, pulls.slice(start, start + BATCH_SIZE))))
  }
  return compareReviewers(viewer, points)
}

const ThemesSchema = z.object({
  themes: z
    .array(
      z.object({
        name: z.string().describe('2-5 words, e.g. "Error paths", "Naming".'),
        description: z.string().describe('One sentence: what these points have in common.'),
        count: z.number().int().describe('How many of the points belong to it.'),
        tip: z.string().describe('One check the reviewer could add to their own reviews, specific to these points.'),
      }),
    )
    .describe('3-6 themes, the largest first.'),
})

const SYSTEM = `You help a code reviewer learn from their teammates.
You get review points other reviewers raised on pull requests this reviewer also reviewed, on code where this
reviewer said nothing. Group them into the kinds of things the others notice, and for each, suggest one concrete check
this reviewer could add. It is feedback for growth, not a judgement: be specific, kind and brief.`

const MAX_THEME_TOKENS = 4000

export function buildThemesPrompt(points: readonly RaisedPoint[]) {
  const listed = points
    .slice(0, MAX_POINTS_SUMMARISED)
    .map((point) => `<point file="${point.path}">\n${point.body.slice(0, POINT_CHARS)}\n</point>`)
    .join('\n')
  return `<points_raised_by_others count="${points.length}">\n${listed}\n</points_raised_by_others>\n\nWhat kinds of things do they catch that I miss? Use the required JSON format.`
}

/** Claude's grouping of what other reviewers raised that you did not. */
export async function summarizeOtherCatches(points: readonly RaisedPoint[]): Promise<CatchTheme[]> {
  if (points.length === 0) {
    return []
  }
  const { answer } = await requestJson({
    schema: ThemesSchema,
    system: SYSTEM,
    prompt: buildThemesPrompt(points),
    maxTokens: MAX_THEME_TOKENS,
    effort: 'medium',
    noun: 'summary',
    onProgress: () => undefined,
  })
  return answer.themes
}
