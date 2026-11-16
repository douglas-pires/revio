import type { PullDetail, PullRef } from '@shared/pull.types'
import { pullKey } from '@shared/pull.types'
import { InFlight } from '../common/in-flight.util'

type Fetch = (ref: PullRef) => Promise<PullDetail>

/**
 * Recent PR details, so hovering a PR in the inbox can prefetch it and opening it is instant.
 * Concurrent requests for the same PR share one fetch.
 */
export class PullCache {
  #entries = new Map<string, { at: number; pr: PullDetail }>()
  readonly #inFlight = new InFlight<PullDetail>()
  readonly #fetch: Fetch

  constructor(fetch: Fetch) {
    this.#fetch = fetch
  }

  /** A cached copy no older than `maxAgeMs`, otherwise a fresh fetch (0 always fetches). */
  get(ref: PullRef, maxAgeMs = 0): Promise<PullDetail> {
    const key = pullKey(ref)
    const hit = this.#entries.get(key)
    if (hit && maxAgeMs > 0 && Date.now() - hit.at <= maxAgeMs) return Promise.resolve(hit.pr)
    return this.#inFlight.run(key, async () => {
      const pr = await this.#fetch(ref)
      this.#entries.set(key, { at: Date.now(), pr })
      return pr
    })
  }

  /** The last fetched copy, if any, without hitting the network. */
  peek(ref: PullRef): PullDetail | undefined {
    return this.#entries.get(pullKey(ref))?.pr
  }
}
