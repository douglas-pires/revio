import { readErrorMessage } from '@shared/error.util.ts'
import { MS_PER_HOUR } from '@shared/time.util.ts'
import type { UpdateStatus } from '@shared/update.types.ts'
import { isNewerVersion } from './release.util.ts'
import type { LatestRelease } from './updates.service.ts'

const FIRST_CHECK_DELAY_MS = 15_000
const CHECK_EVERY_HOURS = 6
const CHECK_EVERY_MS = CHECK_EVERY_HOURS * MS_PER_HOUR

interface UpdatePollerDeps {
  current: string
  /** The latest release, or null when there is none (or the token cannot see the repository). */
  loadLatest: () => Promise<LatestRelease | null>
  /** Where releases live, for the "none found" message; null when the app has no release source. */
  sourceName: string | null
  onStatus: (status: UpdateStatus) => void
}

/** Checks GitHub for a newer Revio: on demand, and every few hours once started. */
export class UpdatePoller {
  #status: UpdateStatus
  #timer: ReturnType<typeof setInterval> | null = null
  #running: Promise<UpdateStatus> | null = null
  readonly #deps: UpdatePollerDeps

  constructor(deps: UpdatePollerDeps) {
    this.#deps = deps
    this.#status = {
      current: deps.current,
      latest: null,
      available: false,
      releaseUrl: null,
      downloadUrl: null,
      notes: '',
      checkedAt: null,
      checking: false,
      error: null,
    }
  }

  get status(): UpdateStatus {
    return this.#status
  }

  start() {
    setTimeout(() => this.check(), FIRST_CHECK_DELAY_MS)
    this.#timer = setInterval(() => this.check(), CHECK_EVERY_MS)
  }

  stop() {
    if (this.#timer) {
      clearInterval(this.#timer)
    }
  }

  /** Checks now; concurrent calls share one check. */
  check(): Promise<UpdateStatus> {
    this.#running ??= this.#check().finally(() => {
      this.#running = null
    })
    return this.#running
  }

  async #check(): Promise<UpdateStatus> {
    const { sourceName } = this.#deps
    if (!sourceName) {
      return this.#set({ error: 'This build has no release source to check.' })
    }
    this.#set({ checking: true, error: null })
    try {
      const latest = await this.#deps.loadLatest()
      const checkedAt = new Date().toISOString()
      if (!latest) {
        return this.#set({
          checking: false,
          checkedAt,
          latest: null,
          available: false,
          error: `No releases found in ${sourceName}, or your GitHub token cannot see it.`,
        })
      }
      return this.#set({
        checking: false,
        checkedAt,
        latest: latest.version,
        available: isNewerVersion(latest.version, this.#deps.current),
        releaseUrl: latest.releaseUrl,
        downloadUrl: latest.downloadUrl,
        notes: latest.notes,
      })
    } catch (err) {
      return this.#set({ checking: false, error: readErrorMessage(err) })
    }
  }

  #set(patch: Partial<UpdateStatus>): UpdateStatus {
    this.#status = { ...this.#status, ...patch }
    this.#deps.onStatus(this.#status)
    return this.#status
  }
}
