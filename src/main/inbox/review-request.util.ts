/** A user always resolves, so an unreadable reviewer can only be a team. */
const isTeam = (r: RawReviewer) => !r || r.__typename === 'Team'

/** A reviewer as GitHub's GraphQL returns it. Teams come back as null when the token lacks read:org. */
export type RawReviewer = { __typename: string; login?: string; slug?: string } | null

export interface RequestEvent {
  createdAt: string
  requestedReviewer: RawReviewer
}

/** Who your open review request is addressed to, and since when. */
export interface ReviewRequest {
  /** Team slug when the request reaches you through a team; "team" when GitHub hides the name. Null when it is addressed to you. */
  viaTeam: string | null
  requestedAt: string | null
}

/**
 * `pending` (the PR's current review requests) says whether you are asked directly; the timeline only
 * says when. An old direct request that was since removed does not count.
 */
export function classifyRequest(
  pending: readonly RawReviewer[],
  timeline: readonly RequestEvent[],
  viewer: string,
): ReviewRequest {
  if (pending.some((r) => r?.login === viewer)) {
    return {
      viaTeam: null,
      requestedAt: timeline.filter((e) => e.requestedReviewer?.login === viewer).at(-1)?.createdAt ?? null,
    }
  }
  const lastTeamEvent = timeline.filter((e) => isTeam(e.requestedReviewer)).at(-1)
  const slug = pending.find((r) => r?.slug)?.slug ?? lastTeamEvent?.requestedReviewer?.slug ?? 'team'
  return { viaTeam: slug, requestedAt: lastTeamEvent?.createdAt ?? null }
}

/**
 * Whether a request still waits on you: you have not reviewed since you were (last) asked.
 * With no known request time, any review of yours counts as answering it.
 */
export function awaitsYou(request: ReviewRequest, yourLastReviewAt: string | null): boolean {
  if (!yourLastReviewAt) {
    return true
  }
  return request.requestedAt !== null && Date.parse(request.requestedAt) > Date.parse(yourLastReviewAt)
}
