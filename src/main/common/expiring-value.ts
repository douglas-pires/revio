import { InFlight } from './in-flight.util.ts'

/** One value loaded at most every `maxAgeMs`; requests while a load runs share it. */
export class ExpiringValue<T> {
  private latest: { at: number; value: T } | null = null
  private readonly inFlight = new InFlight<T>()
  private readonly load: () => Promise<T>
  private readonly maxAgeMs: number

  constructor(load: () => Promise<T>, maxAgeMs: number) {
    this.load = load
    this.maxAgeMs = maxAgeMs
  }

  get(): Promise<T> {
    if (this.latest && Date.now() - this.latest.at <= this.maxAgeMs) {
      return Promise.resolve(this.latest.value)
    }
    return this.inFlight.run('value', async () => {
      const value = await this.load()
      this.latest = { at: Date.now(), value }
      return value
    })
  }

  /** Drops the value, so the next request loads it again. */
  forget(): void {
    this.latest = null
  }
}
