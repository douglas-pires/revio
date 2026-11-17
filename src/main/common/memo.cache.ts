import { InFlight } from './in-flight.util'

/** Remembers results that never change for a key (e.g. anything addressed by commit sha). Concurrent loads share one call. */
export class MemoCache<T> {
  readonly #values = new Map<string, T>()
  readonly #inFlight = new InFlight<T>()

  constructor(private readonly maxEntries = 200) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    if (this.#values.has(key)) return this.#values.get(key)!
    return this.#inFlight.run(key, async () => {
      const value = await load()
      if (this.#values.size >= this.maxEntries) this.#values.delete(this.#values.keys().next().value!)
      this.#values.set(key, value)
      return value
    })
  }
}
