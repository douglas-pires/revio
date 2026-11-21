import { describe, expect, it } from 'vitest'
import { listRemoteUrls, readGitDir, readGithubRepo, resolvePathInside } from './local-clone.util.ts'

describe('githubRepoOf', () => {
  it('reads https and ssh remotes, ignoring case and .git', () => {
    expect(readGithubRepo('https://github.com/Acme/Widgets.git')).toBe('acme/widgets')
    expect(readGithubRepo('git@github.com:acme/widgets')).toBe('acme/widgets')
    expect(readGithubRepo('ssh://git@github.com/acme/widgets.git/')).toBe('acme/widgets')
  })

  it('ignores other hosts', () => {
    expect(readGithubRepo('https://gitlab.com/acme/widgets.git')).toBeNull()
  })
})

describe('remoteUrlsIn', () => {
  it('lists the url of every remote, and nothing from other sections', () => {
    const config = [
      '[core]',
      '\trepositoryformatversion = 0',
      '[remote "origin"]',
      '\turl = git@github.com:acme/widgets.git',
      '\tfetch = +refs/heads/*:refs/remotes/origin/*',
      '[branch "main"]',
      '\tremote = origin',
      '[remote "upstream"]',
      '\turl = https://github.com/upstream/widgets.git',
      '[submodule "docs"]',
      '\turl = https://github.com/acme/docs.git',
    ].join('\n')
    expect(listRemoteUrls(config)).toEqual([
      'git@github.com:acme/widgets.git',
      'https://github.com/upstream/widgets.git',
    ])
  })
})

describe('gitDirOf', () => {
  it('reads where a linked worktree keeps its git data', () => {
    expect(readGitDir('gitdir: /code/widgets/.git/worktrees/fix\n')).toBe('/code/widgets/.git/worktrees/fix')
    expect(readGitDir('')).toBeNull()
  })
})

describe('pathInside', () => {
  it('resolves paths inside the clone', () => {
    expect(resolvePathInside('/r', 'src/a.ts')).toBe('/r/src/a.ts')
  })

  it('refuses paths that leave it', () => {
    expect(resolvePathInside('/r', '../etc/passwd')).toBeNull()
    expect(resolvePathInside('/r', 'src/../../x')).toBeNull()
    expect(resolvePathInside('/r', '/etc/passwd')).toBeNull()
    expect(resolvePathInside('/r', '')).toBeNull()
    expect(resolvePathInside('/r', '.')).toBeNull()
  })
})
