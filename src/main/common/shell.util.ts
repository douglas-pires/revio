import { execFile, spawn } from 'node:child_process'
import { MS_PER_SECOND } from '@shared/time.util.ts'
import { env } from './env.config.ts'

// Apps launched from Finder/Dock do not inherit the user's shell PATH, so tools
// like `gh` and `claude` are resolved through a login shell.
const SHELL = env.SHELL || '/bin/zsh'

/** The most output a login-shell command may print. */
const MAX_SHELL_OUTPUT_BYTES = 10_485_760 // 10 MiB

let cachedPath: string | null = null

function runInLoginShell(command: string, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      SHELL,
      ['-ilc', command],
      { timeout: timeoutMs, maxBuffer: MAX_SHELL_OUTPUT_BYTES },
      (failure, stdout, stderr) => {
        if (failure) {
          reject(new Error(stderr.trim() || failure.message))
        } else {
          resolve(stdout.trim())
        }
      },
    )
  })
}

async function readShellPath(): Promise<string> {
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
  binary: string,
  args: string[],
  input: string,
  opts: { cwd?: string; timeoutMs: number; onStderr?: (line: string) => void; onStdout?: (chunk: string) => void },
): Promise<string> {
  const path = await readShellPath()
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: opts.cwd,
      env: { ...env, PATH: path },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${binary} timed out after ${Math.round(opts.timeoutMs / MS_PER_SECOND)}s`))
    }, opts.timeoutMs)
    child.stdout.on('data', (buffer: Buffer) => {
      stdout += buffer.toString()
      opts.onStdout?.(buffer.toString())
    })
    child.stderr.on('data', (buffer: Buffer) => {
      stderr += buffer.toString()
      opts.onStderr?.(buffer.toString())
    })
    child.on('error', (failure) => {
      clearTimeout(timer)
      reject(failure)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr.trim() || stdout.trim() || `${binary} exited with code ${code}`))
      }
    })
    child.stdin.end(input)
  })
}
