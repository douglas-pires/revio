import type { ThreadsInbox } from '@shared/thread.types.ts'
import { InFlight } from '../common/in-flight.util.ts'

/** The last threads fetch, reused for `maxAgeMs`; concurrent callers share one request. */
export class ThreadCache {
  private last: ThreadsInbox | null = null
  private readonly inFlight = new InFlight<ThreadsInbox>()
  private readonly load: () => Promise<ThreadsInbox>

  constructor(load: () => Promise<ThreadsInbox>) {
    this.load = load
  }

  get(maxAgeMs = 0): Promise<ThreadsInbox> {
    const { last } = this
    if (last && maxAgeMs > 0 && Date.now() - Date.parse(last.fetchedAt) <= maxAgeMs) {
      return Promise.resolve(last)
    }
    return this.inFlight.run('threads', async () => {
      this.last = await this.load()
      return this.last
    })
  }

  /** Drops the cached copy after you change a thread, so the next read is fresh. */
  forget() {
    this.last = null
  }
}
