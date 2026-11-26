import type { RevioApi } from '@shared/api.contract.ts'
import type { ApprovedPull, MissLesson } from '@shared/learn.types.ts'
import { buildPullKey } from '@shared/pull.types.ts'
import type { PastReview } from '@shared/review-history.types.ts'
import { ExpiringValue } from '../common/expiring-value.ts'
import { MemoCache } from '../common/memo.cache.ts'
import { getGithubClient } from '../github/github.client.ts'
import type { PullCache } from '../pulls/pull.cache.ts'
import { findAfterMergeFixes } from './after-merge.service.ts'
import { writeMissLesson } from './miss-lesson.service.ts'

type LearnMethods = 'listAfterMergeFixes' | 'explainMiss'

/** Two hours: fixes land slowly, and finding them costs several searches. */
const AFTER_MERGE_MAX_AGE_MS = 7_200_000
/** A PR's diff is fetched again if older than this; a merged PR does not change. */
const MERGED_PULL_MAX_AGE_MS = 86_400_000

/** What your past reviews can teach: fixes that followed PRs you approved, and what those reviews missed. */
export function buildLearnApi(deps: {
  reviewHistory: ExpiringValue<PastReview[]>
  pulls: PullCache
}): Pick<RevioApi, LearnMethods> {
  const afterMerge = new ExpiringValue<ApprovedPull[]>(
    async () => findAfterMergeFixes(await getGithubClient(), await deps.reviewHistory.get()),
    AFTER_MERGE_MAX_AGE_MS,
  )
  const lessons = new MemoCache<MissLesson>()
  return {
    listAfterMergeFixes: () => afterMerge.get(),
    explainMiss: (original, fix) =>
      lessons.get(`${buildPullKey(original)}>${buildPullKey(fix)}`, async () =>
        writeMissLesson(
          await deps.pulls.get(original, MERGED_PULL_MAX_AGE_MS),
          await deps.pulls.get(fix, MERGED_PULL_MAX_AGE_MS),
        ),
      ),
  }
}
