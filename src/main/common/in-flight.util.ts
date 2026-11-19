/** Runs at most one job per key at a time: callers that arrive while it runs share its promise. */
export class InFlight<T> {
  readonly #pending = new Map<string, Promise<T>>()

  run(key: string, job: () => Promise<T>): Promise<T> {
    const running = this.#pending.get(key)
    if (running) {
      return running
    }
    const started = job().finally(() => this.#pending.delete(key))
    this.#pending.set(key, started)
    return started
  }
}
