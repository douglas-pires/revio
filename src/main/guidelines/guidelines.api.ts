import type { RevioApi } from '@shared/api.contract.ts'
import type { InboxPoller } from '../inbox/inbox.poller.ts'
import type { ReviewHistoryCache } from '../reviews/review-history.cache.ts'
import { findSimilarComments } from '../reviews/similar-comments.util.ts'
import type { store as appStore } from '../store/store.service.ts'
import { addGuideEntry, deleteGuideline, resolveGuidelines, saveGuideline } from './guidelines.service.ts'

type GuidelineMethods =
  | 'listGuidelines'
  | 'saveGuideline'
  | 'deleteGuideline'
  | 'resolveGuidelines'
  | 'knownRepos'
  | 'addGuideEntry'
  | 'findSimilarComments'

/** Repositories you might write a guide for: those with guides already, and those in your inbox, sorted. */
function listKnownRepos(store: typeof appStore, poller: Pick<InboxPoller, 'latest'>): string[] {
  const inbox = poller.latest
  const repos = new Set(
    store
      .guidelines()
      .map((guideline) => guideline.repo)
      .filter((repo) => repo !== '*'),
  )
  for (const pull of [...(inbox?.requested ?? []), ...(inbox?.reviewed ?? [])]) {
    repos.add(pull.repo)
  }
  return [...repos].sort((left, right) => left.localeCompare(right))
}

/** The review guides' API calls, and finding the comments you keep writing, which belong in one. */
export function buildGuidelinesApi(deps: {
  store: typeof appStore
  poller: InboxPoller
  reviewHistory: ReviewHistoryCache
}): Pick<RevioApi, GuidelineMethods> {
  const { store, poller, reviewHistory } = deps
  return {
    listGuidelines: async () => store.guidelines(),
    saveGuideline: async (guideline) => saveGuideline(guideline),
    deleteGuideline: async (id) => deleteGuideline(id),
    resolveGuidelines: async (repo, paths) => resolveGuidelines(repo, paths),
    knownRepos: async () => listKnownRepos(store, poller),
    addGuideEntry: async (entry) => addGuideEntry(entry),
    findSimilarComments: async (body) => findSimilarComments(body, await reviewHistory.get()),
  }
}
