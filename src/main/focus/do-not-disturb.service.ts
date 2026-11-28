import { execFile, spawn } from 'node:child_process'
import { type DoNotDisturbShortcuts, parseShortcutList, pickShortcutToRun } from './do-not-disturb.util.ts'

/** macOS's command-line runner for the Shortcuts app. */
const SHORTCUTS_BINARY = '/usr/bin/shortcuts'
const RUN_TIMEOUT_MS = 20_000

function runShortcutsCommand(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(SHORTCUTS_BINARY, args, { timeout: RUN_TIMEOUT_MS }, (failure, stdout, stderr) => {
      if (failure) {
        reject(new Error(stderr.trim() || failure.message))
      } else {
        resolve(stdout)
      }
    })
  })
}

/** The names of your shortcuts in the Shortcuts app; none when it cannot be asked. */
export async function listShortcuts() {
  try {
    return parseShortcutList(await runShortcutsCommand(['list']))
  } catch {
    return []
  }
}

/**
 * Turns Do Not Disturb on and off with the shortcuts you chose, for review blocks. Calls run one after another, so
 * two quick calls never run the same shortcut twice.
 */
export class DoNotDisturb {
  private turnedOn = false
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly readShortcuts: () => DoNotDisturbShortcuts) {}

  set(on: boolean) {
    const change = this.queue.then(() => this.apply(on))
    this.queue = change.catch(() => undefined)
    return change
  }

  /** On quit: turns off what Revio turned on, in a process that outlives Revio. */
  release() {
    const shortcut = pickShortcutToRun(false, this.turnedOn, this.readShortcuts())
    if (shortcut !== null) {
      spawn(SHORTCUTS_BINARY, ['run', shortcut], { detached: true, stdio: 'ignore' }).unref()
      this.turnedOn = false
    }
  }

  private async apply(on: boolean) {
    const shortcut = pickShortcutToRun(on, this.turnedOn, this.readShortcuts())
    if (shortcut === null) {
      // Nothing to turn off when Revio did not turn it on; with no "off" shortcut, forget it was on.
      this.turnedOn = on && this.turnedOn
      return
    }
    try {
      await runShortcutsCommand(['run', shortcut])
    } catch (failure) {
      throw new Error(`The “${shortcut}” shortcut failed: ${(failure as Error).message}`)
    }
    this.turnedOn = on
  }
}
