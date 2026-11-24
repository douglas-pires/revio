import type { RevioApi } from '@shared/api.contract.ts'
import { getGithubClient } from '../github/github.client.ts'
import type { store as appStore } from '../store/store.service.ts'
import type { ReleaseSource } from '../updates/release.util.ts'
import { findUnseenUpdate, isRelease } from './unseen-update.util.ts'
import { fetchReleaseNotes } from './whats-new.service.ts'

type WhatsNewMethods = 'getUnseenUpdate' | 'markUpdateSeen' | 'listReleaseNotes'

/** What changed in Revio's releases, and whether the running one was installed since you last used it. */
export function buildWhatsNewApi(deps: {
  store: typeof appStore
  source: ReleaseSource | null
  current: string
}): Pick<RevioApi, WhatsNewMethods> {
  const { store, source, current } = deps
  return {
    getUnseenUpdate: async () => {
      const update = findUnseenUpdate({ current, seen: store.seenRelease(), usedBefore: store.usedBefore() })
      return await Promise.resolve(update)
    },
    markUpdateSeen: async () => {
      if (isRelease(current)) {
        store.saveSeenRelease(current)
      }
      await Promise.resolve()
    },
    listReleaseNotes: async () => {
      if (!source) {
        throw new Error('This build does not know where Revio lives on GitHub.')
      }
      return fetchReleaseNotes(await getGithubClient(), source)
    },
  }
}
