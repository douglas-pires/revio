import type { RevioApi } from '@shared/api.contract.ts'
import type { EditorService } from '../editor/editor.service.ts'
import { fetchCommitCi, GitLogService } from './git-log.service.ts'

type GitLogMethods = 'listLocalRepos' | 'getBranches' | 'getLog' | 'getCommit' | 'getCommitCi'

/** The git log's API calls, reading the clones the editor service finds. */
export function gitLogApi(editor: EditorService): Pick<RevioApi, GitLogMethods> {
  const gitLog = new GitLogService(editor)
  return {
    listLocalRepos: async () => gitLog.repos(),
    getBranches: (repo) => gitLog.branches(repo),
    getLog: (repo, query) => gitLog.log(repo, query),
    getCommit: (repo, hash) => gitLog.commit(repo, hash),
    getCommitCi: (repo, hashes) => fetchCommitCi(repo, hashes),
  }
}
