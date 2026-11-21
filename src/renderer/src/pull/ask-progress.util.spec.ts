import { describe, expect, it } from 'vitest'
import { addActivity, countSecondsSince, finishProgress, startProgress } from '@/pull/ask-progress.util.ts'

describe('ask progress', () => {
  it('collects steps in order and joins the reasoning', () => {
    let progress = startProgress('t1', 1000)
    progress = addActivity(progress, { kind: 'step', label: 'Reading a.ts' })
    progress = addActivity(progress, { kind: 'step', label: 'Thinking' })
    progress = addActivity(progress, { kind: 'thinking', text: 'Status 0 ' })
    progress = addActivity(progress, { kind: 'thinking', text: 'means a timeout.' })
    expect(progress.steps).toEqual(['Reading a.ts', 'Thinking'])
    expect(progress.thinking).toBe('Status 0 means a timeout.')
  })

  it('counts whole seconds, never zero', () => {
    const progress = startProgress('t1', 1000)
    expect(countSecondsSince(progress, 1200)).toBe(1)
    expect(countSecondsSince(progress, 8600)).toBe(8)
  })

  it('stops counting once the answer is in', () => {
    const done = finishProgress(startProgress('t1', 1000), 6000)
    expect(countSecondsSince(done, 60_000)).toBe(5)
  })
})
