import { execFile, spawn } from 'node:child_process'

// Apps launched from Finder/Dock do not inherit the user's shell PATH, so tools
// like `gh` and `claude` are resolved through a login shell.
const SHELL = process.env.SHELL || '/bin/zsh'

export function loginShell(command: string, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(SHELL, ['-ilc', command], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message))
      else resolve(stdout.trim())
    })
  })
}

let cachedPath: string | null = null
export async function shellPath(): Promise<string> {
  if (cachedPath) return cachedPath
  try {
    cachedPath = (await loginShell('printf %s "$PATH"')) || process.env.PATH || ''
  } catch {
    cachedPath = process.env.PATH ?? ''
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
  const PATH = await shellPath()
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, env: { ...process.env, PATH }, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${bin} timed out after ${Math.round(opts.timeoutMs / 1000)}s`))
    }, opts.timeoutMs)
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString()
      opts.onStdout?.(d.toString())
    })
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString()
      opts.onStderr?.(d.toString())
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(err.trim() || out.trim() || `${bin} exited with code ${code}`))
    })
    child.stdin.end(input)
  })
}
