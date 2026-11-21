import { execFile, spawn } from 'node:child_process'
import { MS_PER_SECOND } from '@shared/time.util.ts'
import { env } from './env.config.ts'

// Apps launched from Finder/Dock do not inherit the user's shell PATH, so tools
// like `gh` and `claude` are resolved through a login shell.
const SHELL = env.SHELL || '/bin/zsh'

/** The most output a login-shell command may print. */
const MAX_SHELL_OUTPUT_BYTES = 10_485_760 // 10 MiB

let cachedPath: string | null = null

export function runInLoginShell(command: string, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      SHELL,
      ['-ilc', command],
      { timeout: timeoutMs, maxBuffer: MAX_SHELL_OUTPUT_BYTES },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr.trim() || err.message))
        } else {
          resolve(stdout.trim())
        }
      },
    )
  })
}

export async function readShellPath(): Promise<string> {
  if (cachedPath) {
    return cachedPath
  }
  try {
    cachedPath = (await runInLoginShell('printf %s "$PATH"')) || env.PATH || ''
  } catch {
    cachedPath = env.PATH ?? ''
  }
  return cachedPath
}

/** Runs a binary with the login-shell PATH, writes `input` to stdin, returns stdout. */
export async function runWithInput(
  bin: string,
  args: string[],
  input: string,
  opts: { cwd?: string; timeoutMs: number; onStderr?: (line: string) => void; onStdout?: (chunk: string) => void },
): Promise<string> {
  const path = await readShellPath()
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: { ...env, PATH: path },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${bin} timed out after ${Math.round(opts.timeoutMs / MS_PER_SECOND)}s`))
    }, opts.timeoutMs)
    child.stdout.on('data', (buffer: Buffer) => {
      out += buffer.toString()
      opts.onStdout?.(buffer.toString())
    })
    child.stderr.on('data', (buffer: Buffer) => {
      err += buffer.toString()
      opts.onStderr?.(buffer.toString())
    })
    child.on('error', (failure) => {
      clearTimeout(timer)
      reject(failure)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve(out)
      } else {
        reject(new Error(err.trim() || out.trim() || `${bin} exited with code ${code}`))
      }
    })
    child.stdin.end(input)
  })
}
