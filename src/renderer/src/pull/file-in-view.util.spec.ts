import { describe, expect, it } from 'vitest'
import { pickFileInView } from '@/pull/file-in-view.util.ts'

const view = { top: 100, bottom: 900 }
// a.ts ends just under the top, b.ts fills most of the screen, c.ts starts near the bottom, d.ts is below.
const files = [
  { path: 'a.ts', top: -400, bottom: 120 },
  { path: 'b.ts', top: 132, bottom: 820 },
  { path: 'c.ts', top: 832, bottom: 1400 },
  { path: 'd.ts', top: 1412, bottom: 1800 },
]

describe('the file you are reading', () => {
  it('keeps the current file while any of it is on screen', () => {
    expect(pickFileInView('c.ts', files, view)).toBe('c.ts')
    expect(pickFileInView('a.ts', files, view)).toBe('a.ts')
  })

  it('takes the file across the reading line once the current one is off screen', () => {
    expect(pickFileInView('d.ts', files, view)).toBe('b.ts')
    expect(pickFileInView(null, files, view)).toBe('b.ts')
  })

  it('takes the first file on screen when none crosses the reading line', () => {
    const gap = [{ path: 'x.ts', top: 300, bottom: 500 }]
    expect(pickFileInView(null, gap, view)).toBe('x.ts')
  })

  it('is null when no file is on screen', () => {
    expect(pickFileInView('a.ts', [{ path: 'a.ts', top: 1000, bottom: 1200 }], view)).toBeNull()
  })
})
