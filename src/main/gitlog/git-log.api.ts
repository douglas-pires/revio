import type { RevioApi } from '@shared/api.contract.ts'
import { getGithubClient } from '../github/github.client.ts'
import { fetchCommitChecks, fetchCommitCi, fetchCommitDetail, fetchPullLog } from './git-log.service.ts'

type GitLogMethods = 'getPullLog' | 'getCommitDetail' | 'getCommitCi' | 'getCommitChecks'

/** The PR git log's API calls, all read from GitHub. */
export function buildGitLogApi(): Pick<RevioApi, GitLogMethods> {
  return {
    getPullLog: async (repo, query) => fetchPullLog(await getGithubClient(), repo, query),
    getCommitDetail: async (repo, hash) => fetchCommitDetail(await getGithubClient(), repo, hash),
    getCommitCi: (repo, hashes) => fetchCommitCi(repo, hashes),
    getCommitChecks: (repo, hash) => fetchCommitChecks(repo, hash),
  }
}
