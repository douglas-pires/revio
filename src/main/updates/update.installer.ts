import { readErrorMessage } from '@shared/error.util.ts'
import type { UpdateInstall } from '@shared/update.types.ts'

/** What downloads, checks and installs a release (electron-updater). */
export interface ReleaseInstaller {
  /** Downloads the latest release and checks it; resolves with its version, or null when there is none newer. */
  download: (onPercent: (percent: number) => void) => Promise<string | null>
  /** Quits, replaces Revio and opens it again. */
  restart: () => void
  /** Calls back when macOS refuses the downloaded update, such as for its signature. */
  onRefused: (listener: (message: string) => void) => void
}

/** Installs an update from Revio: downloads it, then restarts into it when you say so. */
export class UpdateInstaller {
  private readonly createInstaller: () => ReleaseInstaller
  private readonly onChange: (install: UpdateInstall) => void
  private installer: ReleaseInstaller | null = null
  private install: UpdateInstall

  constructor(deps: {
    supported: boolean
    createInstaller: () => ReleaseInstaller
    onChange: (install: UpdateInstall) => void
  }) {
    this.createInstaller = deps.createInstaller
    this.onChange = deps.onChange
    this.install = { phase: 'idle' }
    if (!deps.supported) {
      this.install = { phase: 'unsupported' }
    }
  }

  get status(): UpdateInstall {
    return this.install
  }

  /** Downloads the update, unless it is already downloading or downloaded, or cannot be installed from here. */
  async download(): Promise<void> {
    if (this.install.phase !== 'idle' && this.install.phase !== 'failed') {
      return
    }
    this.change({ phase: 'downloading', percent: 0 })
    try {
      const version = await this.getInstaller().download((percent) => this.change({ phase: 'downloading', percent }))
      if (version === null) {
        this.change({ phase: 'failed', message: 'The release has no update for this Mac.' })
        return
      }
      this.change({ phase: 'ready', version })
    } catch (failure) {
      this.change({ phase: 'failed', message: readErrorMessage(failure) })
    }
  }

  /** Restarts into the downloaded update; does nothing before it is downloaded. */
  restart() {
    if (this.install.phase === 'ready') {
      this.getInstaller().restart()
    }
  }

  private getInstaller(): ReleaseInstaller {
    if (!this.installer) {
      this.installer = this.createInstaller()
      this.installer.onRefused((message) => this.change({ phase: 'failed', message }))
    }
    return this.installer
  }

  private change(install: UpdateInstall) {
    this.install = install
    this.onChange(install)
  }
}
