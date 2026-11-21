import type { Octokit } from '@octokit/rest'
import type { DraftComment, PullRef, ReviewEvent, SubmitReviewInput } from '@shared/pull.types.ts'
import { getGithubClient } from '../github/github.client.ts'
import { splitRepo } from '../github/repo-name.util.ts'
import { planReview, type ReviewPlan } from './review-plan.util.ts'

// biome-ignore lint/style/useConsistentTypeDefinitions: a type alias, unlike an interface, fits Octokit's index-signature parameter type.
export type ReviewDraft = {
  owner: string
  repo: string
  pull_number: number
  commit_id: string
  body?: string
  comments: ReviewPlan['lineComments']
}

/**
 * File comments can only join a review through GraphQL: create the review pending, add each file as a
 * thread, then submit. A failure deletes the pending review so nothing is left half-posted.
 */
export async function submitWithFileComments(
  octokit: Octokit,
  review: ReviewDraft,
  files: ReviewPlan['fileComments'],
  event: ReviewEvent,
) {
  const pending = await octokit.pulls.createReview(review)
  const ids = { owner: review.owner, repo: review.repo, pull_number: review.pull_number, review_id: pending.data.id }
  try {
    for (const fileComment of files) {
      // biome-ignore lint/performance/noAwaitInLoops: threads are added one at a time so they keep the order they were drafted in.
      await addFileThread(octokit, pending.data.node_id, fileComment)
    }
    const res = await octokit.pulls.submitReview({ ...ids, event, ...(review.body && { body: review.body }) })
    return { url: res.data.html_url }
  } catch (err) {
    await octokit.pulls.deletePendingReview(ids).catch(() => {
      // Best effort: the original error is the one worth reporting.
    })
    throw err
  }
}

export async function addFileThread(
  octokit: Octokit,
  reviewId: string,
  { path, body }: { path: string; body: string },
) {
  await octokit.graphql(
    `mutation ($review: ID!, $path: String!, $body: String!) {
      addPullRequestReviewThread(input: { pullRequestReviewId: $review, path: $path, body: $body, subjectType: FILE }) { thread { id } }
    }`,
    { review: reviewId, path, body },
  )
}

export async function submitReview(input: SubmitReviewInput, drafts: DraftComment[]): Promise<{ url: string }> {
  const octokit = await getGithubClient()
  const { owner, repo } = splitRepo(input.repo)
  const plan = planReview(drafts)
  for (const reply of plan.replies) {
    // biome-ignore lint/performance/noAwaitInLoops: replies are posted in the order they were written.
    await octokit.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: input.number,
      comment_id: reply.commentId,
      body: reply.body,
    })
  }
  const review: ReviewDraft = {
    owner,
    repo,
    pull_number: input.number,
    commit_id: input.headSha,
    comments: plan.lineComments,
  }
  if (input.body) {
    review.body = input.body
  }
  if (plan.fileComments.length === 0) {
    const res = await octokit.pulls.createReview({ ...review, event: input.event })
    return { url: res.data.html_url }
  }
  return submitWithFileComments(octokit, review, plan.fileComments, input.event)
}

export async function replyToComment({ repo: repoFull, number }: PullRef, commentId: number, body: string) {
  const octokit = await getGithubClient()
  const { owner, repo } = splitRepo(repoFull)
  await octokit.pulls.createReplyForReviewComment({ owner, repo, pull_number: number, comment_id: commentId, body })
}

/** Posts a comment in the PR conversation (not on code) and returns its link. */
export async function commentOnPull({ repo: repoFull, number }: PullRef, body: string): Promise<{ url: string }> {
  const octokit = await getGithubClient()
  const { owner, repo } = splitRepo(repoFull)
  const { data } = await octokit.issues.createComment({ owner, repo, issue_number: number, body })
  return { url: data.html_url }
}
