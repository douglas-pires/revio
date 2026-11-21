import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { EditorInfo, EditorTarget } from '@shared/editor.types.ts'
import { shell } from 'electron'
import { findClones } from './clone-finder.service.ts'
import { EDITORS, type EditorSpec, launchFor } from './editor-launch.util.ts'
import { pathInside, REPO_NAME } from './local-clone.util.ts'

const APP_FOLDERS = [
  '/Applications',
  join(homedir(), 'Applications'),
  join(homedir(), 'Applications', 'JetBrains Toolbox'),
]

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
  const name = EDITORS.find((editor) => editor.id === chosen)?.name ?? chosen
  return `${name} is not installed. Pick another editor in Settings.`
}

/** A positive whole line number, or null to open the file at its top. */
function validLine(line: number | undefined): number | null {
  if (line !== undefined && Number.isInteger(line) && line > 0) {
    return line
  }
  return null
}

/** The known editors installed on this Mac. */
export function installedEditors(): EditorInfo[] {
  return EDITORS.filter((editor) => appPathOf(editor)).map(({ id, name }) => ({ id, name }))
}

/** Finds and remembers where your clones of GitHub repositories live, and opens their files in your editor. */
export class EditorService {
  /** Clones found by the last scan, by lowercased `owner/name`. */
  #clones = new Map<string, string>()
  readonly #settings: () => { editor: string; codeFolders: string[] }

  constructor(settings: () => { editor: string; codeFolders: string[] }) {
    this.#settings = settings
  }

  /** Every clone in your code folders and home folder (rescanned each call), by repository name. */
  listClones(): { repo: string; path: string }[] {
    this.#clones = findClones(this.#listSearchRoots())
    return [...this.#clones]
      .map(([repo, path]) => ({ repo, path }))
      .sort((left, right) => left.repo.localeCompare(right.repo))
  }

  /** Your code folders (with "~" expanded) and your home folder: where clones are looked for. */
  #listSearchRoots() {
    return [...this.#settings().codeFolders.map((folder) => folder.replace(HOME_PREFIX, homedir())), homedir()]
  }

  /** The clone of `repo` in your code folders or your home folder (up to three folders below them), or null. */
  findClone(repo: string): string | null {
    const key = repo.toLowerCase()
    const known = this.#clones.get(key)
    if (known && existsSync(known)) {
      return known
    }
    // Not found, or moved since: scan again, which also picks up clones made since the last scan.
    this.#clones = findClones(this.#listSearchRoots())
    return this.#clones.get(key) ?? null
  }

  #editor(): { spec: EditorSpec; appPath: string } {
    const chosen = this.#settings().editor
    let order = EDITORS
    if (chosen) {
      order = EDITORS.filter((editor) => editor.id === chosen)
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
    const clone = this.findClone(target.repo)
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
