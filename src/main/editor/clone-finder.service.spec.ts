import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findClones } from './clone-finder.service.ts'

/** Makes `dir` look like a clone whose origin is `remote`. */
function clone(dir: string, remote: string) {
  mkdirSync(join(dir, '.git'), { recursive: true })
  writeFileSync(join(dir, '.git', 'config'), `[remote "origin"]\n\turl = ${remote}\n`)
}

describe('findClones', () => {
  it('finds clones by their remote, whatever the folder is called, up to three folders down', () => {
    const home = mkdtempSync(join(tmpdir(), 'revio-clones-'))
    clone(join(home, 'dotfiles-repo'), 'git@github.com:me/dotfiles.git')
    clone(join(home, 'Projects', 'widgets-v2'), 'https://github.com/acme/widgets.git')
    clone(join(home, 'Projects', 'work', 'api'), 'git@github.com:corp/api-server.git')
    clone(join(home, 'a', 'b', 'c', 'too-deep'), 'git@github.com:corp/hidden.git')
    clone(join(home, 'Projects', 'app', 'node_modules', 'dep'), 'git@github.com:npm/dep.git')
    const found = findClones([home])
    expect(Object.fromEntries(found)).toEqual({
      'me/dotfiles': join(home, 'dotfiles-repo'),
      'acme/widgets': join(home, 'Projects', 'widgets-v2'),
      'corp/api-server': join(home, 'Projects', 'work', 'api'),
    })
  })

  it('prefers the shallowest clone and does not look inside clones', () => {
    const home = mkdtempSync(join(tmpdir(), 'revio-clones-'))
    clone(join(home, 'widgets'), 'git@github.com:acme/widgets.git')
    clone(join(home, 'old', 'widgets'), 'git@github.com:acme/widgets.git')
    clone(join(home, 'widgets', 'vendored'), 'git@github.com:acme/vendored.git')
    const found = findClones([home])
    expect(found.get('acme/widgets')).toBe(join(home, 'widgets'))
    expect(found.has('acme/vendored')).toBe(false)
  })

  it('reads a linked worktree through its main repository', () => {
    const home = mkdtempSync(join(tmpdir(), 'revio-clones-'))
    clone(join(home, 'main'), 'git@github.com:acme/widgets.git')
    const gitDir = join(home, 'main', '.git', 'worktrees', 'fix')
    mkdirSync(gitDir, { recursive: true })
    writeFileSync(join(gitDir, 'commondir'), '../..\n')
    mkdirSync(join(home, 'other', 'fix'), { recursive: true })
    writeFileSync(join(home, 'other', 'fix', '.git'), `gitdir: ${gitDir}\n`)
    const found = findClones([join(home, 'other')])
    expect(found.get('acme/widgets')).toBe(join(home, 'other', 'fix'))
  })
})
