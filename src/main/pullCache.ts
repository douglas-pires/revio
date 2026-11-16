import type { PullDetail } from '@shared/types'
import { pullKey } from '@shared/types'

type Fetch = (repo: string, number: number) => Promise<PullDetail>

/**
 * Recent PR details, so hovering a PR in the inbox can prefetch it and opening it is instant.
 * Concurrent requests for the same PR share one fetch.
 */
export class PullCache {
  #entries = new Map<string, { at: number; pr: PullDetail }>()
  #inFlight = new Map<string, Promise<PullDetail>>()
  readonly #fetch: Fetch

  constructor(fetch: Fetch) {
    this.#fetch = fetch
  }

  /** A cached copy no older than `maxAgeMs`, otherwise a fresh fetch (0 always fetches). */
  get(repo: string, number: number, maxAgeMs = 0): Promise<PullDetail> {
    const key = pullKey(repo, number)
    const hit = this.#entries.get(key)
    if (hit && maxAgeMs > 0 && Date.now() - hit.at <= maxAgeMs) return Promise.resolve(hit.pr)
    let pending = this.#inFlight.get(key)
    if (!pending) {
      pending = this.#fetch(repo, number)
        .then((pr) => {
          this.#entries.set(key, { at: Date.now(), pr })
          return pr
        })
        .finally(() => this.#inFlight.delete(key))
      this.#inFlight.set(key, pending)
    }
    return pending
  }

  /** The last fetched copy, if any, without hitting the network. */
  peek(repo: string, number: number): PullDetail | undefined {
    return this.#entries.get(pullKey(repo, number))?.pr
  }
}
