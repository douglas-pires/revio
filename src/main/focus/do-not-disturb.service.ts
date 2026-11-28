import { execFile, spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, shell } from 'electron'
import {
  buildShortcutPlist,
  findMissingShortcuts,
  parseShortcutList,
  pickShortcutToRun,
  REVIO_SHORTCUTS,
} from './do-not-disturb.util.ts'

/** macOS's command-line tools for the Shortcuts app and for property lists. */
const SHORTCUTS_BINARY = '/usr/bin/shortcuts'
const PLUTIL_BINARY = '/usr/bin/plutil'
const RUN_TIMEOUT_MS = 20_000

function runCommand(binary: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(binary, args, { timeout: RUN_TIMEOUT_MS }, (failure, stdout, stderr) => {
      if (failure) {
        reject(new Error(stderr.trim() || failure.message))
      } else {
        resolve(stdout)
      }
    })
  })
}

/** Which of Revio's two shortcuts are missing from the Shortcuts app; both when it cannot be asked. */
async function listMissingShortcuts() {
  try {
    return findMissingShortcuts(parseShortcutList(await runCommand(SHORTCUTS_BINARY, ['list'])))
  } catch {
    return Object.values(REVIO_SHORTCUTS)
  }
}

/** Whether Revio's shortcuts are in the Shortcuts app, so the Do Not Disturb switch can work. */
export async function isDoNotDisturbReady() {
  return (await listMissingShortcuts()).length === 0
}

/** Writes one of Revio's shortcuts, signs it (macOS only adds signed shortcuts) and returns its file. */
async function writeSignedShortcut(folder: string, name: string, turnOn: boolean) {
  const plist = join(folder, `${name}.plist`)
  const unsigned = join(folder, `${name} unsigned.shortcut`)
  const signed = join(folder, `${name}.shortcut`)
  await writeFile(plist, buildShortcutPlist(turnOn))
  await runCommand(PLUTIL_BINARY, ['-convert', 'binary1', '-o', unsigned, plist])
  await runCommand(SHORTCUTS_BINARY, ['sign', '--mode', 'anyone', '--input', unsigned, '--output', signed])
  return signed
}

/** Offers the missing shortcuts to the Shortcuts app, which asks you to add each. */
export async function addDoNotDisturbShortcuts() {
  const folder = join(app.getPath('temp'), 'revio-shortcuts')
  await mkdir(folder, { recursive: true })
  for (const name of await listMissingShortcuts()) {
    const file = await writeSignedShortcut(folder, name, name === REVIO_SHORTCUTS.on)
    const failure = await shell.openPath(file)
    if (failure) {
      throw new Error(`Could not open the “${name}” shortcut: ${failure}`)
    }
  }
}

/**
 * Turns Do Not Disturb on and off with Revio's shortcuts, for review blocks, while the switch is on. Calls run one
 * after another, so two quick calls never run the same shortcut twice.
 */
export class DoNotDisturb {
  private turnedOn = false
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly readSwitch: () => boolean) {}

  set(on: boolean) {
    const change = this.queue.then(() => this.apply(on))
    this.queue = change.catch(() => undefined)
    return change
  }

  /** On quit: turns off what Revio turned on, in a process that outlives Revio. */
  release() {
    const shortcut = pickShortcutToRun(false, this.turnedOn, this.readSwitch())
    if (shortcut !== null) {
      spawn(SHORTCUTS_BINARY, ['run', shortcut], { detached: true, stdio: 'ignore' }).unref()
      this.turnedOn = false
    }
  }

  private async apply(on: boolean) {
    const shortcut = pickShortcutToRun(on, this.turnedOn, this.readSwitch())
    if (shortcut === null) {
      return
    }
    try {
      await runCommand(SHORTCUTS_BINARY, ['run', shortcut])
    } catch (failure) {
      throw new Error(`Could not change Do Not Disturb: ${(failure as Error).message}`)
    }
    this.turnedOn = on
  }
}
