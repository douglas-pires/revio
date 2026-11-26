import { describe, expect, it } from 'vitest'
import { readCliFailure } from './cli-failure.util.ts'

describe('readCliFailure', () => {
  it('reads the message out of the CLI’s JSON result', () => {
    expect(readCliFailure('{"is_error":true,"result":"Credit balance is too low","usage":{}}')).toBe(
      'Credit balance is too low',
    )
  })

  it('keeps any other output as it is', () => {
    expect(readCliFailure('claude: command not found')).toBe('claude: command not found')
    expect(readCliFailure('{"is_error":true}')).toBe('{"is_error":true}')
  })
})
