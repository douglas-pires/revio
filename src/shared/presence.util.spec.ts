import { describe, expect, it } from 'vitest'
import { isPresent } from './presence.util.ts'

describe('isPresent', () => {
  it('keeps falsy values that are not null or undefined', () => {
    expect([0, '', null, false, undefined, 'a'].filter(isPresent)).toEqual([0, '', false, 'a'])
  })
})
