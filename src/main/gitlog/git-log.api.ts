import type { RevioApi } from '@shared/api.contract.ts'
import type { EditorService } from '../editor/editor.service.ts'
import { GitActionsService } from './git-actions.service.ts'
import { fetchCommitChecks, fetchCommitCi, GitLogService } from './git-log.service.ts'

type GitLogMethods =
  | 'listLocalRepos'
  | 'getBranches'
  | 'getLog'
  | 'getCommit'
  | 'getCommitCi'
  | 'getLocalCommitFilePatch'
  | 'getCommitChecks'
  | 'checkoutBranch'
  | 'cherryPick'

/** The git log's API calls, reading (and, for checkout and cherry-pick, changing) the clones the editor finds. */
export function buildGitLogApi(editor: EditorService): Pick<RevioApi, GitLogMethods> {
  const gitLog = new GitLogService(editor)
  const gitActions = new GitActionsService(editor)
  return {
    listLocalRepos: async () => gitLog.listRepos(),
    getBranches: (repo) => gitLog.readBranches(repo),
    getLog: (repo, query) => gitLog.readLog(repo, query),
    getCommit: (repo, hash) => gitLog.readCommit(repo, hash),
    getCommitCi: (repo, hashes) => fetchCommitCi(repo, hashes),
    getLocalCommitFilePatch: (repo, hash, path) => gitLog.readFilePatch(repo, hash, path),
    getCommitChecks: (repo, hash) => fetchCommitChecks(repo, hash),
    checkoutBranch: (repo, branch) => gitActions.checkoutBranch(repo, branch),
    cherryPick: (repo, hash) => gitActions.cherryPick(repo, hash),
  }
}
