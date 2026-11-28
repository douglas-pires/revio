import { describe, expect, it } from 'vitest'
import { MOVE_SETTLE_MS, pickKeptFile } from './use-file-scroll-spy.hook.ts'

describe('pickKeptFile', () => {
  it('keeps the file you just went to while its own scrolling settles', () => {
    expect(pickKeptFile('src/cart.ts', 100)).toBe('src/cart.ts')
  })

  it('lets the reading line decide once you scroll yourself', () => {
    expect(pickKeptFile('src/cart.ts', MOVE_SETTLE_MS)).toBeNull()
  })
})
