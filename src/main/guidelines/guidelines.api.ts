import type { RevioApi } from '@shared/api.contract.ts'
import type { InboxPoller } from '../inbox/inbox.poller.ts'
import type { store as appStore } from '../store/store.service.ts'
import { deleteGuideline, resolveGuidelines, saveGuideline } from './guidelines.service.ts'

type GuidelineMethods = 'listGuidelines' | 'saveGuideline' | 'deleteGuideline' | 'resolveGuidelines' | 'knownRepos'

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

/** The review guides' API calls. */
export function buildGuidelinesApi(store: typeof appStore, poller: InboxPoller): Pick<RevioApi, GuidelineMethods> {
  return {
    listGuidelines: async () => store.guidelines(),
    saveGuideline: async (guideline) => saveGuideline(guideline),
    deleteGuideline: async (id) => deleteGuideline(id),
    resolveGuidelines: async (repo, paths) => resolveGuidelines(repo, paths),
    knownRepos: async () => listKnownRepos(store, poller),
  }
}
