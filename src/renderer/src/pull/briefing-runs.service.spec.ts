import type { BriefingRecord } from '@shared/claude.types.ts'
import { describe, expect, it, vi } from 'vitest'
import { BriefingRuns } from './briefing-runs.service.ts'

const PULL = { repo: 'acme/payments', number: 1 }
const KEY = 'acme/payments#1'
const RECORD = { headSha: 'abc' } as BriefingRecord

/** Runs whose one request finishes when the test says so. */
function createRuns() {
  let resolve: (record: BriefingRecord) => void = () => undefined
  let reject: (failure: Error) => void = () => undefined
  const answer = new Promise<BriefingRecord>((resolveAnswer, rejectAnswer) => {
    resolve = resolveAnswer
    reject = rejectAnswer
  })
  const generate = vi.fn(() => answer)
  let report: (message: string) => void = () => undefined
  const stopWatching = vi.fn()
  const runs = new BriefingRuns({
    generate,
    watchProgress: (_key, onProgress) => {
      report = onProgress
      return stopWatching
    },
  })
  return { runs, request: { resolve, reject }, generate, stopWatching, report: (message: string) => report(message) }
}

describe('BriefingRuns', () => {
  it('keeps a running briefing for whoever comes back to the PR', () => {
    const { runs, report } = createRuns()
    runs.start(PULL)
    report('Reading the diff')
    expect(runs.status(KEY)).toEqual({ loading: true, progress: 'Reading the diff', error: null })
    expect(runs.status('acme/payments#2').loading).toBe(false)
  })

  it('asks Claude once, however often it is started while running', () => {
    const { runs, generate } = createRuns()
    runs.start(PULL)
    runs.start(PULL)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('hands the briefing to a screen opened after it started, and not to one already left', async () => {
    const { runs, request, stopWatching } = createRuns()
    const left = vi.fn()
    const opened = vi.fn()
    const leave = runs.watchRecord(KEY, left)
    const started = runs.start(PULL)
    leave()
    runs.watchRecord(KEY, opened)
    request.resolve(RECORD)
    await started
    expect(opened).toHaveBeenCalledWith(RECORD)
    expect(left).not.toHaveBeenCalled()
    expect(runs.status(KEY).loading).toBe(false)
    expect(stopWatching).toHaveBeenCalled()
  })

  it('keeps the error, and can start again after it', async () => {
    const { runs, request, generate } = createRuns()
    const started = runs.start(PULL)
    request.reject(new Error('No Claude on this Mac'))
    await started
    expect(runs.status(KEY)).toEqual({ loading: false, progress: null, error: 'No Claude on this Mac' })
    runs.start(PULL)
    expect(generate).toHaveBeenCalledTimes(2)
  })
})
