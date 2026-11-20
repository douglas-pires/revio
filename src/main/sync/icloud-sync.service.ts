import { execFile } from 'node:child_process'
import {
  existsSync,
  type FSWatcher,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  watch,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { errorMessage } from '@shared/error.util.ts'
import type { SyncStatus } from '@shared/settings.types.ts'
import { MS_PER_MINUTE } from '@shared/time.util.ts'
import type { SyncSnapshot } from './sync.types.ts'
import { mergeSnapshots, parseSyncFile, sameSnapshot } from './sync-merge.util.ts'

const FOLDER = 'Revio'
const FILE = 'settings-sync.json'
/** When two Macs write at once, iCloud keeps both: "settings-sync 2.json" beside the file. */
const CONFLICT_COPY = /^settings-sync \d+\.json$/u
/** A file iCloud has not downloaded to this Mac yet shows up as ".name.icloud". */
const NOT_DOWNLOADED = `.${FILE}.icloud`
/** A burst of folder events, or of changes here, is synced once. */
const SETTLE_MS = 750
/** Folder events can be missed (sleep, iCloud restarts), so sync this often anyway. */
const SYNC_EVERY_MINUTES = 5
const SYNC_EVERY_MS = SYNC_EVERY_MINUTES * MS_PER_MINUTE

interface IcloudSyncDeps {
  /** The iCloud Drive folder; a test points it at a temporary folder. */
  drive: string
  enabled: () => boolean
  /** This Mac's synced settings and guides. */
  local: () => SyncSnapshot
  /** Takes in the merged settings and guides. */
  apply: (snapshot: SyncSnapshot) => void
  onStatus: (status: SyncStatus, applied: boolean) => void
  /** Asks iCloud to download a file it has only as a placeholder. */
  download?: (path: string) => void
}

const OFF: SyncStatus = { state: 'off', lastSyncedAt: null, message: null }

function downloadWithBrctl(path: string) {
  execFile('/usr/bin/brctl', ['download', path], (err) => {
    if (err) {
      console.error('Could not ask iCloud to download the sync file', err)
    }
  })
}

/**
 * This Mac's snapshot merged with each sync file in `names`, and the main file's own snapshot (null when it is missing
 * or unreadable). Fails only on a file this Revio must not replace.
 */
function mergeFiles(dir: string, names: string[], local: SyncSnapshot) {
  let merged = local
  let remote: SyncSnapshot | null = null
  for (const name of names) {
    const parsed = parseSyncFile(readFileSync(join(dir, name), 'utf8'))
    if (parsed.ok) {
      merged = mergeSnapshots(merged, parsed.snapshot)
      if (name === FILE) {
        remote = parsed.snapshot
      }
    } else if (!parsed.replaceable) {
      return { error: parsed.error }
    }
  }
  return { merged, remote }
}

/**
 * Keeps the synced settings and the review guides in one JSON file in iCloud Drive. Each sync reads the file (and any
 * conflict copies iCloud made), merges them with this Mac's copy, takes in what changed and writes the result back.
 */
export class IcloudSync {
  #status: SyncStatus = OFF
  #watcher: FSWatcher | null = null
  #timer: ReturnType<typeof setInterval> | null = null
  #pending: ReturnType<typeof setTimeout> | null = null
  readonly #deps: IcloudSyncDeps

  constructor(deps: IcloudSyncDeps) {
    this.#deps = deps
  }

  get status(): SyncStatus {
    return this.#status
  }

  get #dir() {
    return join(this.#deps.drive, FOLDER)
  }

  /** Starts or stops syncing to match the setting, syncing at once when it is on. */
  refresh(): SyncStatus {
    if (!this.#deps.enabled()) {
      this.stop()
      return this.#set(OFF, false)
    }
    const status = this.syncNow()
    this.#watch()
    this.#timer ??= setInterval(() => this.syncNow(), SYNC_EVERY_MS)
    return status
  }

  stop() {
    this.#watcher?.close()
    this.#watcher = null
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }
    this.#cancelPending()
  }

  /** Something synced changed on this Mac: sync shortly, once for a burst of changes. */
  localChanged() {
    if (this.#deps.enabled()) {
      this.#later()
    }
  }

  /** Syncs a change still waiting to go out, e.g. before quitting. */
  flush() {
    if (this.#pending) {
      this.#cancelPending()
      this.syncNow()
    }
  }

  syncNow(): SyncStatus {
    this.#cancelPending()
    if (!this.#deps.enabled()) {
      return this.#set(OFF, false)
    }
    if (!existsSync(this.#deps.drive)) {
      return this.#set(
        { state: 'unavailable', lastSyncedAt: null, message: 'Turn on iCloud Drive for this Mac in System Settings.' },
        false,
      )
    }
    try {
      return this.#sync()
    } catch (err) {
      return this.#set({ ...this.#status, state: 'error', message: errorMessage(err) }, false)
    }
  }

  #sync(): SyncStatus {
    const dir = this.#dir
    mkdirSync(dir, { recursive: true })
    const names = readdirSync(dir)
    if (!names.includes(FILE) && names.includes(NOT_DOWNLOADED)) {
      ;(this.#deps.download ?? downloadWithBrctl)(join(dir, FILE))
      return this.#set({ ...this.#status, state: 'downloading', message: null }, false)
    }
    const copies = names.filter((n) => CONFLICT_COPY.test(n))
    const local = this.#deps.local()
    const read = mergeFiles(
      dir,
      [FILE, ...copies].filter((n) => names.includes(n)),
      local,
    )
    if ('error' in read) {
      return this.#set({ ...this.#status, state: 'error', message: read.error }, false)
    }
    const { merged, remote } = read
    const applied = !sameSnapshot(merged, local)
    if (applied) {
      this.#deps.apply(merged)
    }
    if (!(remote && sameSnapshot(merged, remote)) || copies.length > 0) {
      this.#write(merged)
      for (const copy of copies) {
        rmSync(join(dir, copy), { force: true })
      }
    }
    return this.#set({ state: 'synced', lastSyncedAt: new Date().toISOString(), message: null }, applied)
  }

  /** Writes the file whole, so iCloud never uploads half of it. */
  #write(snapshot: SyncSnapshot) {
    const tmp = join(this.#dir, `.${FILE}.tmp`)
    writeFileSync(tmp, JSON.stringify(snapshot, null, 2))
    renameSync(tmp, join(this.#dir, FILE))
  }

  #watch() {
    if (this.#watcher || !existsSync(this.#dir)) {
      return
    }
    try {
      this.#watcher = watch(this.#dir, (_event, name) => {
        // Our own temporary file comes and goes on every write.
        if (name !== `.${FILE}.tmp`) {
          this.#later()
        }
      })
      this.#watcher.on('error', () => {
        this.#watcher = null
      })
    } catch (err) {
      console.error('Could not watch the iCloud sync folder; syncing on a timer instead', err)
    }
  }

  #later() {
    this.#cancelPending()
    this.#pending = setTimeout(() => this.syncNow(), SETTLE_MS)
  }

  #cancelPending() {
    if (this.#pending) {
      clearTimeout(this.#pending)
      this.#pending = null
    }
  }

  #set(status: SyncStatus, applied: boolean): SyncStatus {
    this.#status = status
    this.#deps.onStatus(status, applied)
    return status
  }
}

/** iCloud Drive's own folder, the one Finder shows as "iCloud Drive". Any app may write there, signed or not. */
export const ICLOUD_DRIVE = join(homedir(), 'Library/Mobile Documents/com~apple~CloudDocs')
