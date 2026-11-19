import { execFile } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { EditorInfo, EditorTarget } from '@shared/editor.types.ts'
import { shell } from 'electron'
import { env } from '../common/env.config.ts'
import { shellPath } from '../common/shell.util.ts'
import { EDITORS, type EditorSpec, launchFor } from './editor-launch.util.ts'
import { cloneCandidates, pathInside, REPO_NAME, remotePointsAt } from './local-clone.util.ts'

const APP_FOLDERS = [
  '/Applications',
  join(homedir(), 'Applications'),
  join(homedir(), 'Applications', 'JetBrains Toolbox'),
]

// Home-folder entries that never hold code and can be large.
const SKIP = new Set(['Library', 'Applications', 'Movies', 'Music', 'Pictures', 'Public', 'node_modules'])

const appPathOf = (editor: EditorSpec) => APP_FOLDERS.map((dir) => join(dir, `${editor.app}.app`)).find(existsSync)

const HOME_PREFIX = /^~(?=$|\/)/u

function run(command: string, args: string[], childEnv?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 10_000, env: childEnv }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr.trim() || err.message))
      } else {
        resolve(stdout)
      }
    })
  })
}

/** Why no editor could be used: the chosen one is missing, or none of the supported ones is installed. */
function missingEditorMessage(chosen: string) {
  if (!chosen) {
    return 'No supported editor found. Pick one in Settings.'
  }
  const name = EDITORS.find((e) => e.id === chosen)?.name ?? chosen
  return `${name} is not installed. Pick another editor in Settings.`
}

/** A positive whole line number, or null to open the file at its top. */
function validLine(line: number | undefined): number | null {
  if (line !== undefined && Number.isInteger(line) && line > 0) {
    return line
  }
  return null
}

async function remotesOf(dir: string): Promise<string[]> {
  if (!existsSync(join(dir, '.git'))) {
    return []
  }
  try {
    const out = await run('git', ['-C', dir, 'config', '--get-regexp', '^remote\\..*\\.url$'], {
      ...env,
      PATH: await shellPath(),
    })
    return out.split('\n').map((line) => line.split(' ')[1] ?? '')
  } catch {
    return []
  }
}

const subfoldersOf = (dir: string) => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !SKIP.has(d.name))
      .map((d) => d.name)
  } catch {
    return []
  }
}

/** The known editors installed on this Mac. */
export function installedEditors(): EditorInfo[] {
  return EDITORS.filter((e) => appPathOf(e)).map(({ id, name }) => ({ id, name }))
}

/** Finds and remembers where your clones of GitHub repositories live, and opens their files in your editor. */
export class EditorService {
  readonly #clones = new Map<string, string>()
  readonly #settings: () => { editor: string; codeFolders: string[] }

  constructor(settings: () => { editor: string; codeFolders: string[] }) {
    this.#settings = settings
  }

  /** The clone of `repo` in your code folders or your home folder (and one level below them), or null. */
  async findClone(repo: string): Promise<string | null> {
    const known = this.#clones.get(repo)
    if (known && existsSync(known)) {
      return known
    }
    const roots = [...this.#settings().codeFolders.map((f) => f.replace(HOME_PREFIX, homedir())), homedir()]
    for (const root of roots) {
      for (const dir of cloneCandidates(root, repo, subfoldersOf(root))) {
        // biome-ignore lint/performance/noAwaitInLoops: folders are checked one at a time and the first clone wins; checking them all at once would start a git process per folder.
        const remotes = await remotesOf(dir)
        if (remotes.some((url) => remotePointsAt(url, repo))) {
          this.#clones.set(repo, dir)
          return dir
        }
      }
    }
    return null
  }

  #editor(): { spec: EditorSpec; appPath: string } {
    const chosen = this.#settings().editor
    let order = EDITORS
    if (chosen) {
      order = EDITORS.filter((e) => e.id === chosen)
    }
    for (const spec of order) {
      const appPath = appPathOf(spec)
      if (appPath) {
        return { spec, appPath }
      }
    }
    throw new Error(missingEditorMessage(chosen))
  }

  async open(target: EditorTarget): Promise<void> {
    if (!REPO_NAME.test(target.repo)) {
      throw new Error(`Bad repository name: ${target.repo}`)
    }
    const clone = await this.findClone(target.repo)
    if (!clone) {
      throw new Error(`No local clone of ${target.repo} found. Add the folder that holds it under Settings → Editor.`)
    }
    const file = pathInside(clone, target.path)
    if (!file) {
      throw new Error(`Bad path: ${target.path}`)
    }
    if (!existsSync(file)) {
      throw new Error(`${target.path} is not in ${clone}. Check out the PR's branch there to open it.`)
    }
    const line = validLine(target.line)
    const { spec, appPath } = this.#editor()
    const launch = launchFor(spec, appPath, file, line)
    if ('url' in launch) {
      await shell.openExternal(launch.url)
    } else {
      await run(launch.command, launch.args)
    }
  }
}
