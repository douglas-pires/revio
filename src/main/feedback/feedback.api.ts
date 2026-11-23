import type { RevioApi } from '@shared/api.contract.ts'
import { getGithubClient } from '../github/github.client.ts'
import type { ReleaseSource } from '../updates/release.util.ts'
import { readSystemInfo, submitFeedback } from './feedback.service.ts'

type FeedbackMethods = 'getSystemInfo' | 'getFeedbackRepo' | 'submitFeedback'

/** Bug reports and feature requests from Settings, opened as issues on Revio's own repository. */
export function buildFeedbackApi(repo: ReleaseSource | null): Pick<RevioApi, FeedbackMethods> {
  return {
    getSystemInfo: () => Promise.resolve(readSystemInfo()),
    getFeedbackRepo: () => Promise.resolve(repo && `${repo.owner}/${repo.repo}`),
    submitFeedback: async (input) => {
      if (!repo) {
        throw new Error('This build does not know where Revio lives on GitHub.')
      }
      return await submitFeedback(getGithubClient, repo, input)
    },
  }
}
