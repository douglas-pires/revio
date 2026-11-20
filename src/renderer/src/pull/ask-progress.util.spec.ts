import { describe, expect, it } from 'vitest'
import { finishedProgress, secondsSince, startProgress, withActivity } from '@/pull/ask-progress.util.ts'

describe('ask progress', () => {
  it('collects steps in order and joins the reasoning', () => {
    let p = startProgress('t1', 1000)
    p = withActivity(p, { kind: 'step', label: 'Reading a.ts' })
    p = withActivity(p, { kind: 'step', label: 'Thinking' })
    p = withActivity(p, { kind: 'thinking', text: 'Status 0 ' })
    p = withActivity(p, { kind: 'thinking', text: 'means a timeout.' })
    expect(p.steps).toEqual(['Reading a.ts', 'Thinking'])
    expect(p.thinking).toBe('Status 0 means a timeout.')
  })

  it('counts whole seconds, never zero', () => {
    const p = startProgress('t1', 1000)
    expect(secondsSince(p, 1200)).toBe(1)
    expect(secondsSince(p, 8600)).toBe(8)
  })

  it('stops counting once the answer is in', () => {
    const done = finishedProgress(startProgress('t1', 1000), 6000)
    expect(secondsSince(done, 60_000)).toBe(5)
  })
})
