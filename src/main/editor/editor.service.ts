import { execFile } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { shell } from 'electron'
import type { EditorInfo, EditorTarget } from '@shared/editor.types'
import { shellPath } from '../common/shell.util'
import { EDITORS, launchFor, type EditorSpec } from './editor-launch.util'
import { cloneCandidates, pathInside, remotePointsAt, REPO_NAME } from './local-clone.util'

const APP_FOLDERS = ['/Applications', join(homedir(), 'Applications'), join(homedir(), 'Applications', 'JetBrains Toolbox')]
// Home-folder entries that never hold code and can be large.
const SKIP = new Set(['Library', 'Applications', 'Movies', 'Music', 'Pictures', 'Public', 'node_modules'])

const appPathOf = (editor: EditorSpec) => APP_FOLDERS.map((dir) => join(dir, `${editor.app}.app`)).find(existsSync)

/** The known editors installed on this Mac. */
export function installedEditors(): EditorInfo[] {
  return EDITORS.filter((e) => appPathOf(e)).map(({ id, name }) => ({ id, name }))
}

function run(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 10_000, env }, (err, stdout, stderr) => (err ? reject(new Error(stderr.trim() || err.message)) : resolve(stdout)))
  })
}

async function remotesOf(dir: string): Promise<string[]> {
  if (!existsSync(join(dir, '.git'))) return []
  try {
    const out = await run('git', ['-C', dir, 'config', '--get-regexp', '^remote\\..*\\.url$'], { ...process.env, PATH: await shellPath() })
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
    if (known && existsSync(known)) return known
    const roots = [...this.#settings().codeFolders.map((f) => f.replace(/^~(?=$|\/)/, homedir())), homedir()]
    for (const root of roots) {
      for (const dir of cloneCandidates(root, repo, subfoldersOf(root))) {
        if ((await remotesOf(dir)).some((url) => remotePointsAt(url, repo))) {
          this.#clones.set(repo, dir)
          return dir
        }
      }
    }
    return null
  }

  #editor(): { spec: EditorSpec; appPath: string } {
    const chosen = this.#settings().editor
    const order = chosen ? EDITORS.filter((e) => e.id === chosen) : EDITORS
    for (const spec of order) {
      const appPath = appPathOf(spec)
      if (appPath) return { spec, appPath }
    }
    throw new Error(chosen ? `${EDITORS.find((e) => e.id === chosen)?.name ?? chosen} is not installed. Pick another editor in Settings.` : 'No supported editor found. Pick one in Settings.')
  }

  async open(target: EditorTarget): Promise<void> {
    if (!REPO_NAME.test(target.repo)) throw new Error(`Bad repository name: ${target.repo}`)
    const clone = await this.findClone(target.repo)
    if (!clone) throw new Error(`No local clone of ${target.repo} found. Add the folder that holds it under Settings → Editor.`)
    const file = pathInside(clone, target.path)
    if (!file) throw new Error(`Bad path: ${target.path}`)
    if (!existsSync(file)) throw new Error(`${target.path} is not in ${clone}. Check out the PR's branch there to open it.`)
    const line = Number.isInteger(target.line) && target.line! > 0 ? target.line : undefined
    const { spec, appPath } = this.#editor()
    const launch = launchFor(spec, appPath, file, line)
    if ('url' in launch) await shell.openExternal(launch.url)
    else await run(launch.command, launch.args)
  }
}
