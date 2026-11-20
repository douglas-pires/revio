import { describe, expect, it } from 'vitest'
import { gitDirOf, githubRepoOf, pathInside, remoteUrlsIn } from './local-clone.util.ts'

describe('githubRepoOf', () => {
  it('reads https and ssh remotes, ignoring case and .git', () => {
    expect(githubRepoOf('https://github.com/Acme/Widgets.git')).toBe('acme/widgets')
    expect(githubRepoOf('git@github.com:acme/widgets')).toBe('acme/widgets')
    expect(githubRepoOf('ssh://git@github.com/acme/widgets.git/')).toBe('acme/widgets')
  })

  it('ignores other hosts', () => {
    expect(githubRepoOf('https://gitlab.com/acme/widgets.git')).toBeNull()
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
    expect(remoteUrlsIn(config)).toEqual(['git@github.com:acme/widgets.git', 'https://github.com/upstream/widgets.git'])
  })
})

describe('gitDirOf', () => {
  it('reads where a linked worktree keeps its git data', () => {
    expect(gitDirOf('gitdir: /code/widgets/.git/worktrees/fix\n')).toBe('/code/widgets/.git/worktrees/fix')
    expect(gitDirOf('')).toBeNull()
  })
})

describe('pathInside', () => {
  it('resolves paths inside the clone', () => {
    expect(pathInside('/r', 'src/a.ts')).toBe('/r/src/a.ts')
  })

  it('refuses paths that leave it', () => {
    expect(pathInside('/r', '../etc/passwd')).toBeNull()
    expect(pathInside('/r', 'src/../../x')).toBeNull()
    expect(pathInside('/r', '/etc/passwd')).toBeNull()
    expect(pathInside('/r', '')).toBeNull()
    expect(pathInside('/r', '.')).toBeNull()
  })
})
