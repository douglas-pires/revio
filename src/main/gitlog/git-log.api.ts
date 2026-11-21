import type { RevioApi } from '@shared/api.contract.ts'
import type { EditorService } from '../editor/editor.service.ts'
import { fetchCommitCi, GitLogService } from './git-log.service.ts'

type GitLogMethods = 'listLocalRepos' | 'getBranches' | 'getLog' | 'getCommit' | 'getCommitCi'

/** The git log's API calls, reading the clones the editor service finds. */
export function buildGitLogApi(editor: EditorService): Pick<RevioApi, GitLogMethods> {
  const gitLog = new GitLogService(editor)
  return {
    listLocalRepos: async () => gitLog.listRepos(),
    getBranches: (repo) => gitLog.readBranches(repo),
    getLog: (repo, query) => gitLog.readLog(repo, query),
    getCommit: (repo, hash) => gitLog.readCommit(repo, hash),
    getCommitCi: (repo, hashes) => fetchCommitCi(repo, hashes),
  }
}
