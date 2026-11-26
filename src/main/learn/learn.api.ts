import type { RevioApi } from '@shared/api.contract.ts'
import type { AfterMergeReport, ApprovedPull, HabitsFilter, MissLesson, SavedCatchThemes } from '@shared/learn.types.ts'
import { buildPullKey, type PullRef } from '@shared/pull.types.ts'
import { ExpiringValue } from '../common/expiring-value.ts'
import { InFlight } from '../common/in-flight.util.ts'
import { getGithubClient, getViewerLogin } from '../github/github.client.ts'
import type { PullCache } from '../pulls/pull.cache.ts'
import type { ReviewHistoryCache } from '../reviews/review-history.cache.ts'
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

/** A value loaded per span of days, each kept for a while. */
function keepPerSpan<T>(load: (days: number) => Promise<T>, maxAgeMs: number) {
  const values = new Map<number, ExpiringValue<T>>()
  return (days: number) => {
    let value = values.get(days)
    if (!value) {
      value = new ExpiringValue(() => load(days), maxAgeMs)
      values.set(days, value)
    }
    return value.get()
  }
}

/** The key a lesson is saved under: the approved PR, then the fix. */
const buildLessonKey = (original: PullRef, fix: PullRef) => `${buildPullKey(original)}>${buildPullKey(fix)}`

/** Which saved themes: drawn from people's points only or bots' and AI reviewers' too, over which period. */
const readThemesScope = (includeBots: boolean, days: number) => {
  if (includeBots) {
    return `everyone:${days}`
  }
  return `people:${days}`
}

/** The list with the lessons learned so far filled in, and those Claude is still writing marked. */
function attachLessons(
  pulls: readonly ApprovedPull[],
  lessons: Readonly<Record<string, MissLesson>>,
  pending: ReadonlySet<string>,
): ApprovedPull[] {
  return pulls.map((pull) => ({
    ...pull,
    followUps: pull.followUps.map((fix) => {
      const key = buildLessonKey(pull, fix)
      return { ...fix, lesson: lessons[key] ?? null, lessonPending: pending.has(key) }
    }),
  }))
}

interface LearnDeps {
  reviewHistory: ReviewHistoryCache
  pulls: PullCache
  store: typeof appStore
}

/** Fixes after PRs you approved, and the lessons Claude draws from them, kept on disk. */
function buildAfterMergeHandlers({ reviewHistory, pulls, store }: LearnDeps) {
  const loadPatches = async (pull: PullRef) => {
    const detail = await pulls.get({ repo: pull.repo, number: pull.number }, MERGED_PULL_MAX_AGE_MS)
    return Object.fromEntries(detail.files.map((file) => [file.path, file.patch]))
  }
  const afterMerge = keepPerSpan<AfterMergeReport>(
    async (days) => findAfterMergeFixes(await getGithubClient(), await reviewHistory.get(days), loadPatches),
    AFTER_MERGE_MAX_AGE_MS,
  )
  const lessons = new InFlight<MissLesson>()
  /** Lessons Claude is writing, so a screen opened meanwhile can wait for them instead of asking again. */
  const pending = new Set<string>()
  const learn = async (key: string, original: PullRef, fix: PullRef) => {
    pending.add(key)
    try {
      const lesson = await writeMissLesson(
        await pulls.get(original, MERGED_PULL_MAX_AGE_MS),
        await pulls.get(fix, MERGED_PULL_MAX_AGE_MS),
      )
      store.saveMissLesson(key, lesson)
      return lesson
    } finally {
      pending.delete(key)
    }
  }
  return {
    listAfterMergeFixes: async (days: number) => {
      const report = await afterMerge(days)
      return { ...report, pulls: attachLessons(report.pulls, store.missLessons(), pending) }
    },
    // Kept on disk, so it is there after leaving the screen; asking while it is being written waits for that answer.
    explainMiss: (original: PullRef, fix: PullRef) => {
      const key = buildLessonKey(original, fix)
      return lessons.run(key, () => learn(key, original, fix))
    },
  }
}

/** What other reviewers raised on PRs you reviewed too, and Claude's grouping of it, kept on disk. */
function buildOtherReviewersHandlers({ reviewHistory, store }: LearnDeps) {
  const reviewPoints = keepPerSpan<PullPoints[]>(
    async (days) => fetchReviewPoints(await getGithubClient(), await reviewHistory.get(days)),
    AFTER_MERGE_MAX_AGE_MS,
  )
  const listSharedReviews = async (includeBots: boolean, days: number) =>
    compareReviewers(await getViewerLogin(), await reviewPoints(days), includeBots)
  const themes = new InFlight<SavedCatchThemes>()
  const groupCatches = async (includeBots: boolean, days: number) => {
    const points = (await listSharedReviews(includeBots, days)).flatMap((review) => review.theyRaised)
    const saved = { createdAt: new Date().toISOString(), themes: await summarizeOtherCatches(points) }
    store.saveCatchThemes(readThemesScope(includeBots, days), saved)
    return saved
  }
  return {
    listSharedReviews,
    getOtherCatches: async (includeBots: boolean, days: number) =>
      store.catchThemes(readThemesScope(includeBots, days)),
    summarizeOtherCatches: (includeBots: boolean, days: number) =>
      themes.run(readThemesScope(includeBots, days), () => groupCatches(includeBots, days)),
  }
}

/** Your habits over a period and scope, and sorting your comments by kind. */
function buildHabitsHandlers({ reviewHistory, store }: LearnDeps) {
  const summarize = async (filter: HabitsFilter) =>
    summarizeHabits(await reviewHistory.get(filter.days), store.commentKinds(), filter)
  return {
    getReviewHabits: summarize,
    // The comments in the period and scope shown are sorted first.
    sortCommentKinds: async (filter: HabitsFilter) => {
      const { counted } = filterReviews(await reviewHistory.get(filter.days), filter)
      await sortNewComments(counted, store.commentKinds(), (kinds) => store.saveCommentKinds(kinds))
      return summarize(filter)
    },
  }
}

/** What your past reviews can teach: fixes after PRs you approved, what others raised that you did not, your habits. */
export function buildLearnApi(deps: LearnDeps): Pick<RevioApi, LearnMethods> {
  return { ...buildAfterMergeHandlers(deps), ...buildOtherReviewersHandlers(deps), ...buildHabitsHandlers(deps) }
}
