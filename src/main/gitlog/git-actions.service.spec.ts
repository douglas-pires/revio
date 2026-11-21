import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorService } from '../editor/editor.service.ts'
import { GitActionsService } from './git-actions.service.ts'

const REPO = 'acme/web'

/**
 * Git without anyone's personal config (signing, hooks, aliases) and with a fixed author, for this file's git
 * commands and the service's alike: both read the process environment.
 */
const ISOLATED_GIT = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
}

/** A throwaway repository: `main` with one file, a `feature` branch with one more commit, and a remote branch. */
function createRepository() {
  const folder = mkdtempSync(join(tmpdir(), 'revio-git-actions-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: folder }).toString().trim()
  git('init', '--initial-branch=main')
  writeFileSync(join(folder, 'notes.txt'), 'first\n')
  git('add', '.')
  git('commit', '-m', 'first')
  git('switch', '-c', 'feature')
  writeFileSync(join(folder, 'feature.txt'), 'feature\n')
  git('add', '.')
  git('commit', '-m', 'add feature')
  const featureCommit = git('rev-parse', 'HEAD')
  git('switch', 'main')
  // A remote like a real clone's, never contacted: its tracking ref is all `git switch --track` needs.
  git('remote', 'add', 'origin', 'https://example.invalid/acme/web.git')
  git('update-ref', 'refs/remotes/origin/remote-only', featureCommit)
  return { folder, git, featureCommit }
}

beforeAll(() => {
  for (const [name, value] of Object.entries(ISOLATED_GIT)) {
    vi.stubEnv(name, value)
  }
})

afterAll(() => {
  vi.unstubAllEnvs()
})

let repository: ReturnType<typeof createRepository>
let actions: GitActionsService

beforeEach(() => {
  repository = createRepository()
  const editor = { findClone: () => repository.folder } as unknown as EditorService
  actions = new GitActionsService(editor)
})

afterEach(() => {
  rmSync(repository.folder, { recursive: true, force: true })
})

describe('checkoutBranch', () => {
  it('checks out a local branch', async () => {
    await actions.checkoutBranch(REPO, 'feature')
    expect(repository.git('branch', '--show-current')).toBe('feature')
  })

  it('checks out a remote branch as a local one that tracks it', async () => {
    await actions.checkoutBranch(REPO, 'origin/remote-only')
    expect(repository.git('branch', '--show-current')).toBe('remote-only')
    expect(repository.git('rev-parse', '--abbrev-ref', 'remote-only@{upstream}')).toBe('origin/remote-only')
  })

  it('refuses a name that is not one of the clone’s branches', async () => {
    await expect(actions.checkoutBranch(REPO, '--orphan=evil')).rejects.toThrow('No branch named')
    expect(repository.git('branch', '--show-current')).toBe('main')
  })
})

describe('cherryPick', () => {
  it('applies the commit on top of the checked-out branch', async () => {
    await actions.cherryPick(REPO, repository.featureCommit)
    expect(repository.git('log', '-1', '--format=%s')).toBe('add feature')
    expect(readFileSync(join(repository.folder, 'feature.txt'), 'utf8')).toBe('feature\n')
  })

  it('refuses while the clone has uncommitted changes, changing nothing', async () => {
    writeFileSync(join(repository.folder, 'notes.txt'), 'edited\n')
    await expect(actions.cherryPick(REPO, repository.featureCommit)).rejects.toThrow('uncommitted changes')
    expect(repository.git('log', '-1', '--format=%s')).toBe('first')
  })

  it('cancels a conflicting cherry-pick and leaves the branch as it was', async () => {
    const { git, folder } = repository
    git('switch', 'feature')
    writeFileSync(join(folder, 'notes.txt'), 'from feature\n')
    git('commit', '-am', 'change notes on feature')
    const conflicting = git('rev-parse', 'HEAD')
    git('switch', 'main')
    writeFileSync(join(folder, 'notes.txt'), 'from main\n')
    git('commit', '-am', 'change notes on main')
    const before = git('rev-parse', 'HEAD')

    await expect(actions.cherryPick(REPO, conflicting)).rejects.toThrow('cancelled, nothing changed')
    expect(git('rev-parse', 'HEAD')).toBe(before)
    expect(git('status', '--porcelain')).toBe('')
  })
})
