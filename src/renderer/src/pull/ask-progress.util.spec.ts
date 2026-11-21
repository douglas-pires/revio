import { describe, expect, it } from 'vitest'
import { finishedProgress, secondsSince, startProgress, withActivity } from '@/pull/ask-progress.util.ts'

describe('ask progress', () => {
  it('collects steps in order and joins the reasoning', () => {
    let progress = startProgress('t1', 1000)
    progress = withActivity(progress, { kind: 'step', label: 'Reading a.ts' })
    progress = withActivity(progress, { kind: 'step', label: 'Thinking' })
    progress = withActivity(progress, { kind: 'thinking', text: 'Status 0 ' })
    progress = withActivity(progress, { kind: 'thinking', text: 'means a timeout.' })
    expect(progress.steps).toEqual(['Reading a.ts', 'Thinking'])
    expect(progress.thinking).toBe('Status 0 means a timeout.')
  })

  it('counts whole seconds, never zero', () => {
    const progress = startProgress('t1', 1000)
    expect(secondsSince(progress, 1200)).toBe(1)
    expect(secondsSince(progress, 8600)).toBe(8)
  })

  it('stops counting once the answer is in', () => {
    const done = finishedProgress(startProgress('t1', 1000), 6000)
    expect(secondsSince(done, 60_000)).toBe(5)
  })
})
