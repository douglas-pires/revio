import { readErrorMessage } from '@shared/error.util.ts'
import { MS_PER_HOUR } from '@shared/time.util.ts'
import type { UpdateInstall, UpdateStatus } from '@shared/update.types.ts'
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
  /** Where installing an update stands at first. */
  install: UpdateInstall
  onStatus: (status: UpdateStatus) => void
}

/** Checks GitHub for a newer Revio: on demand, and every few hours once started. */
export class UpdatePoller {
  private currentStatus: UpdateStatus
  private timer: ReturnType<typeof setInterval> | null = null
  private running: Promise<UpdateStatus> | null = null
  private readonly deps: UpdatePollerDeps

  constructor(deps: UpdatePollerDeps) {
    this.deps = deps
    this.currentStatus = {
      current: deps.current,
      latest: null,
      available: false,
      releaseUrl: null,
      downloadUrl: null,
      notes: '',
      checkedAt: null,
      checking: false,
      error: null,
      install: deps.install,
    }
  }

  get status(): UpdateStatus {
    return this.currentStatus
  }

  start() {
    setTimeout(() => this.check(), FIRST_CHECK_DELAY_MS)
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }

  /** Reports where installing the update stands along with what the check found. */
  setInstall(install: UpdateInstall) {
    this.setStatus({ install })
  }

  /** Checks now; concurrent calls share one check. */
  check(): Promise<UpdateStatus> {
    this.running ??= this.runCheck().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async runCheck(): Promise<UpdateStatus> {
    const { sourceName } = this.deps
    if (!sourceName) {
      return this.setStatus({ error: 'This build has no release source to check.' })
    }
    this.setStatus({ checking: true, error: null })
    try {
      const latest = await this.deps.loadLatest()
      const checkedAt = new Date().toISOString()
      if (!latest) {
        return this.setStatus({
          checking: false,
          checkedAt,
          latest: null,
          available: false,
          error: `No releases found in ${sourceName}, or your GitHub token cannot see it.`,
        })
      }
      return this.setStatus({
        checking: false,
        checkedAt,
        latest: latest.version,
        available: isNewerVersion(latest.version, this.deps.current),
        releaseUrl: latest.releaseUrl,
        downloadUrl: latest.downloadUrl,
        notes: latest.notes,
      })
    } catch (failure) {
      return this.setStatus({ checking: false, error: readErrorMessage(failure) })
    }
  }

  private setStatus(patch: Partial<UpdateStatus>): UpdateStatus {
    this.currentStatus = { ...this.currentStatus, ...patch }
    this.deps.onStatus(this.currentStatus)
    return this.currentStatus
  }
}
