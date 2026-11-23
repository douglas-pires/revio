import { InFlight } from './in-flight.util.ts'

const DEFAULT_MAX_ENTRIES = 200

/** Remembers results that never change for a key (e.g. anything addressed by commit sha). Concurrent loads share one call. */
export class MemoCache<T> {
  private readonly values = new Map<string, T>()
  private readonly inFlight = new InFlight<T>()

  private readonly maxEntries: number

  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries
  }

  get(key: string, load: () => Promise<T>): Promise<T> {
    if (this.values.has(key)) {
      return Promise.resolve(this.values.get(key) as T)
    }
    return this.inFlight.run(key, async () => {
      const value = await load()
      this.makeRoom()
      this.values.set(key, value)
      return value
    })
  }

  /** Drops the oldest entry once the cache is full. */
  private makeRoom() {
    const oldest = this.values.keys().next()
    if (this.values.size >= this.maxEntries && !oldest.done) {
      this.values.delete(oldest.value)
    }
  }
}
