import { describe, expect, it } from 'vitest'
import { pickFileToUnview } from './last-viewed.util.ts'

describe('pickFileToUnview', () => {
  const files = ['a.ts', 'b.ts', 'c.ts'].map((path) => ({ path, sha: `sha-${path}` }))

  it('is the file you are reading when it is viewed', () => {
    const viewed = { 'a.ts': 'sha-a.ts', 'b.ts': 'sha-b.ts' }
    expect(pickFileToUnview(files, viewed, 'a.ts')?.path).toBe('a.ts')
  })

  it('is otherwise the file you marked last, wherever it is in the list', () => {
    const viewed = { 'c.ts': 'sha-c.ts', 'a.ts': 'sha-a.ts' }
    expect(pickFileToUnview(files, viewed, 'b.ts')?.path).toBe('a.ts')
  })

  it('skips files that changed since they were viewed, or left the PR', () => {
    const viewed = { 'a.ts': 'sha-a.ts', 'b.ts': 'old', 'gone.ts': 'sha' }
    expect(pickFileToUnview(files, viewed, null)?.path).toBe('a.ts')
    expect(pickFileToUnview(files, {}, 'a.ts')).toBeUndefined()
  })
})
