import { readErrorMessage } from '@shared/error.util.ts'
import type { Branch } from '@shared/git-log.types.ts'
import type { EditorService } from '../editor/editor.service.ts'
import { assertCommitHash, runGit } from './git-command.service.ts'
import { requireClone } from './git-log.service.ts'
import { BRANCH_FORMAT, parseBranches } from './git-log.util.ts'

/** The branch `name` among the clone's own branches; a name the page sends is never passed to git as it is. */
async function requireBranch(clonePath: string, name: string): Promise<Branch> {
  const args = ['for-each-ref', `--format=${BRANCH_FORMAT}`, 'refs/heads', 'refs/remotes']
  const branch = parseBranches(await runGit(clonePath, args)).find((candidate) => candidate.name === name)
  if (!branch) {
    throw new Error(`No branch named ${name} in this clone.`)
  }
  return branch
}

/** The local branch a remote one is checked out as: `origin/feat/x` → `feat/x`. */
function readLocalName(remoteBranch: string) {
  return remoteBranch.slice(remoteBranch.indexOf('/') + 1)
}

/** Fails when the working tree has uncommitted changes, which a cherry-pick could mix with its own. */
async function assertCleanWorkingTree(clonePath: string) {
  const status = await runGit(clonePath, ['status', '--porcelain', '--untracked-files=no'])
  if (status.trim()) {
    throw new Error('The clone has uncommitted changes. Commit or stash them first.')
  }
}

/** Changes your local clones: checking out branches and cherry-picking commits. */
export class GitActionsService {
  readonly #editor: EditorService

  constructor(editor: EditorService) {
    this.#editor = editor
  }

  /**
   * Checks out a branch. A remote branch is checked out as a local branch that tracks it (`origin/x` → `x`), as
   * `git switch` does. Git refuses, and says why, when your uncommitted changes would be lost.
   */
  async checkoutBranch(repo: string, name: string): Promise<void> {
    const clonePath = requireClone(this.#editor, repo)
    const branch = await requireBranch(clonePath, name)
    if (branch.kind === 'local') {
      await runGit(clonePath, ['switch', branch.name])
      return
    }
    await runGit(clonePath, ['switch', '--track', '-c', readLocalName(branch.name), branch.name])
  }

  /** Applies a commit on top of the checked-out branch. On a conflict it is aborted, leaving the branch as it was. */
  async cherryPick(repo: string, hash: string): Promise<void> {
    assertCommitHash(hash)
    const clonePath = requireClone(this.#editor, repo)
    await assertCleanWorkingTree(clonePath)
    try {
      await runGit(clonePath, ['cherry-pick', hash])
    } catch (failure) {
      await runGit(clonePath, ['cherry-pick', '--abort']).catch(() => {
        // Nothing to abort when git refused before starting.
      })
      throw new Error(`The cherry-pick was cancelled, nothing changed: ${readErrorMessage(failure)}`, {
        cause: failure,
      })
    }
  }
}
