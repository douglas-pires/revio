import type { BriefingRecord } from '@shared/claude.types.ts'
import { buildPullKey, type PullRef } from '@shared/pull.types.ts'
import { readErrorMessage } from '../common/format.util.ts'

/** How a PR's briefing stands while Claude writes it, or why it failed. */
export interface BriefingStatus {
  loading: boolean
  progress: string | null
  error: string | null
}

/** Asks Claude for a briefing, and reports its progress; the returned function stops the reports. */
export interface BriefingSource {
  generate: (pull: PullRef) => Promise<BriefingRecord>
  watchProgress: (key: string, onProgress: (message: string) => void) => () => void
}

type RecordListener = (record: BriefingRecord) => void

const IDLE: BriefingStatus = { loading: false, progress: null, error: null }

/** Adds to the set kept under a key, and returns the way to take it out again. */
function addListener<T>(listenersByKey: Map<string, Set<T>>, key: string, listener: T) {
  const listeners = listenersByKey.get(key) ?? new Set<T>()
  listenersByKey.set(key, listeners.add(listener))
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The briefings being written, by PR. They live outside the PR screen, so leaving it and coming back finds the same
 * request still running (or its error) instead of starting another. Finished ones are saved by the main process.
 */
export class BriefingRuns {
  private readonly source: BriefingSource
  private readonly statuses = new Map<string, BriefingStatus>()
  private readonly statusListeners = new Map<string, Set<() => void>>()
  private readonly recordListeners = new Map<string, Set<RecordListener>>()

  constructor(source: BriefingSource) {
    this.source = source
  }

  status(key: string): BriefingStatus {
    return this.statuses.get(key) ?? IDLE
  }

  watchStatus(key: string, listener: () => void) {
    return addListener(this.statusListeners, key, listener)
  }

  watchRecord(key: string, listener: RecordListener) {
    return addListener(this.recordListeners, key, listener)
  }

  /** Starts a briefing, unless one is already being written for this PR. */
  async start(pull: PullRef): Promise<void> {
    const key = buildPullKey(pull)
    if (this.status(key).loading) {
      return
    }
    this.setStatus(key, { ...IDLE, loading: true })
    const stopWatching = this.source.watchProgress(key, (progress) =>
      this.setStatus(key, { ...IDLE, loading: true, progress }),
    )
    try {
      const record = await this.source.generate(pull)
      this.setStatus(key, IDLE)
      this.announce(key, record)
    } catch (failure) {
      this.setStatus(key, { ...IDLE, error: readErrorMessage(failure) })
    } finally {
      stopWatching()
    }
  }

  private setStatus(key: string, status: BriefingStatus) {
    this.statuses.set(key, status)
    for (const listener of this.statusListeners.get(key) ?? []) {
      listener()
    }
  }

  private announce(key: string, record: BriefingRecord) {
    for (const listener of this.recordListeners.get(key) ?? []) {
      listener(record)
    }
  }
}
