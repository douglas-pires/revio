import type { RevioApi } from '@shared/api.contract.ts'
import type { ApprovedPull, HabitsFilter, MissLesson, SavedCatchThemes } from '@shared/learn.types.ts'
import { buildPullKey, type PullRef } from '@shared/pull.types.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { ExpiringValue } from '../common/expiring-value.ts'
import { InFlight } from '../common/in-flight.util.ts'
import { getGithubClient, getViewerLogin } from '../github/github.client.ts'
import type { PullCache } from '../pulls/pull.cache.ts'
import type { store as appStore } from '../store/store.service.ts'
import { findAfterMergeFixes } from './after-merge.service.ts'
import { sortNewComments } from './comment-kinds.service.ts'
import { compareReviewers, type PullPoints } from './compare-reviewers.util.ts'
import { filterReviews, summarizeHabits } from './habits.util.ts'
import { writeMissLesson } from './miss-lesson.service.ts'
import { fetchReviewPoints, summarizeOtherCatches } from './other-reviewers.service.ts'

type LearnMethods =
  | 'listAfterMergeFixes'
  | 'explainMiss'
  | 'listSharedReviews'
  | 'getOtherCatches'
  | 'summarizeOtherCatches'
  | 'getReviewHabits'
  | 'sortCommentKinds'

/** Two hours: what your past reviews show changes slowly, and finding it costs many requests. */
const AFTER_MERGE_MAX_AGE_MS = 7_200_000
/** A PR's diff is fetched again if older than this; a merged PR does not change. */
const MERGED_PULL_MAX_AGE_MS = 86_400_000

/** The key a lesson is saved under: the approved PR, then the fix. */
const buildLessonKey = (original: PullRef, fix: PullRef) => `${buildPullKey(original)}>${buildPullKey(fix)}`

/** Which saved themes: those drawn from people's points only, or from bots' and AI reviewers' too. */
const readThemesScope = (includeBots: boolean) => {
  if (includeBots) {
    return 'everyone'
  }
  return 'people'
}

/** The list with the lessons learned so far filled in. */
function attachLessons(pulls: readonly ApprovedPull[], lessons: Readonly<Record<string, MissLesson>>): ApprovedPull[] {
  return pulls.map((pull) => ({
    ...pull,
    followUps: pull.followUps.map((fix) => ({ ...fix, lesson: lessons[buildLessonKey(pull, fix)] ?? null })),
  }))
}

/** What your past reviews can teach: fixes after PRs you approved, what others raised that you did not, your habits. */
export function buildLearnApi(deps: {
  reviewHistory: ExpiringValue<PastReview[]>
  pulls: PullCache
  store: typeof appStore
}): Pick<RevioApi, LearnMethods> {
  const { store } = deps
  const summarize = async (filter: HabitsFilter) =>
    summarizeHabits(await deps.reviewHistory.get(), store.commentKinds(), filter)
  const afterMerge = new ExpiringValue<ApprovedPull[]>(
    async () => findAfterMergeFixes(await getGithubClient(), await deps.reviewHistory.get()),
    AFTER_MERGE_MAX_AGE_MS,
  )
  const reviewPoints = new ExpiringValue<PullPoints[]>(
    async () => fetchReviewPoints(await getGithubClient(), await deps.reviewHistory.get()),
    AFTER_MERGE_MAX_AGE_MS,
  )
  const listSharedReviews = async (includeBots: boolean) =>
    compareReviewers(await getViewerLogin(), await reviewPoints.get(), includeBots)
  const themes = new InFlight<SavedCatchThemes>()
  const groupCatches = async (includeBots: boolean) => {
    const points = (await listSharedReviews(includeBots)).flatMap((review) => review.theyRaised)
    const saved = { createdAt: new Date().toISOString(), themes: await summarizeOtherCatches(points) }
    store.saveCatchThemes(readThemesScope(includeBots), saved)
    return saved
  }
  const lessons = new InFlight<MissLesson>()
  const learn = async (original: PullRef, fix: PullRef) => {
    const lesson = await writeMissLesson(
      await deps.pulls.get(original, MERGED_PULL_MAX_AGE_MS),
      await deps.pulls.get(fix, MERGED_PULL_MAX_AGE_MS),
    )
    store.saveMissLesson(buildLessonKey(original, fix), lesson)
    return lesson
  }
  return {
    listAfterMergeFixes: async () => attachLessons(await afterMerge.get(), store.missLessons()),
    // Kept on disk, so it is there after leaving the screen (or while it is still being written when you come back).
    listSharedReviews,
    getOtherCatches: async (includeBots) => store.catchThemes(readThemesScope(includeBots)),
    summarizeOtherCatches: (includeBots) => themes.run(readThemesScope(includeBots), () => groupCatches(includeBots)),
    explainMiss: (original, fix) => lessons.run(buildLessonKey(original, fix), () => learn(original, fix)),
    getReviewHabits: summarize,
    // The comments in the period and scope shown are sorted first.
    sortCommentKinds: async (filter) => {
      const { counted } = filterReviews(await deps.reviewHistory.get(), filter)
      await sortNewComments(counted, store.commentKinds(), (kinds) => store.saveCommentKinds(kinds))
      return summarize(filter)
    },
  }
}
