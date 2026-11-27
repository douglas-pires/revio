import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { readErrorMessage } from '@shared/error.util.ts'
import { app } from 'electron'
import { z } from 'zod'
import { env } from '../common/env.config.ts'
import { runWithInput } from '../common/shell.util.ts'
import { store } from '../store/store.service.ts'
import { readCliFailure } from './cli-failure.util.ts'

/** Ten minutes. */
const CLI_TIMEOUT_MS = 600_000
/** Progress lines from the CLI are cut to this length. */
const MAX_PROGRESS_CHARS = 200
const FENCED_JSON = /```(?:json)?\s*(?<json>[\s\S]*?)```/u

const BACKEND_LABELS: Record<'api' | 'cli', string> = { api: 'the Anthropic API', cli: 'Claude Code' }

/** One request for an answer in a fixed JSON shape. */
export interface JsonRequest<T> {
  schema: z.ZodType<T>
  system: string
  prompt: string
  maxTokens: number
  effort: 'low' | 'medium' | 'high'
  /** What the answer is, for errors: "briefing", "explanation". */
  noun: string
  onProgress: (message: string) => void
}

async function requestViaApi<T>(request: JsonRequest<T>, model: string): Promise<T> {
  const apiKey = store.anthropicKey()
  const client = new Anthropic({ ...(apiKey !== undefined && { apiKey }) })
  const response = await client.beta.messages.parse({
    model,
    max_tokens: request.maxTokens,
    system: request.system,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: request.effort, format: betaZodOutputFormat(request.schema) },
    messages: [{ role: 'user', content: request.prompt }],
  })
  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined to write this ${request.noun}.`)
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error(`The ${request.noun} was cut off (max_tokens). Try again.`)
  }
  if (!response.parsed_output) {
    throw new Error(`Claude returned an unreadable ${request.noun}.`)
  }
  return response.parsed_output
}

/** The JSON in a text answer: a fenced block, else the outermost braces, else the whole text. */
function extractJson(text: string) {
  const fenced = FENCED_JSON.exec(text)?.groups?.json
  if (fenced) {
    return fenced
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1)
  }
  return text
}

async function requestViaCli<T>(request: JsonRequest<T>, model: string): Promise<T> {
  // The CLI's validator does not know the draft-2020 meta-schema tag Zod emits.
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(request.schema, { target: 'draft-7' })
  const args = ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(jsonSchema), '--model', model]
  const output = await runWithInput(
    'claude',
    [...args, '--tools', '', '--system-prompt', request.system, '--no-session-persistence'],
    request.prompt,
    {
      cwd: app.getPath('temp'),
      timeoutMs: CLI_TIMEOUT_MS,
      onStderr: (line) => request.onProgress(line.trim().slice(0, MAX_PROGRESS_CHARS)),
    },
  ).catch((failure: unknown) => {
    throw new Error(`Claude Code: ${readCliFailure(readErrorMessage(failure))}`, { cause: failure })
  })
  const result = JSON.parse(output) as { is_error?: boolean; result?: string; structured_output?: unknown }
  if (result.is_error) {
    throw new Error(result.result || 'Claude Code returned an error')
  }
  return request.schema.parse(result.structured_output ?? JSON.parse(extractJson(result.result ?? '')))
}

/** The API when a key is set (or chosen in Settings), otherwise your Claude Code login. */
export function pickBackend(): 'api' | 'cli' {
  const settings = store.settings()
  if (settings.claudeBackend !== 'auto') {
    return settings.claudeBackend
  }
  if (store.anthropicKey() || env.ANTHROPIC_API_KEY) {
    return 'api'
  }
  return 'cli'
}

/** Asks Claude, through the backend in use, for an answer in the request's JSON shape. */
export async function requestJson<T>(request: JsonRequest<T>) {
  const backend = pickBackend()
  const model = store.settings().claudeModel
  request.onProgress(`Asking ${model} via ${BACKEND_LABELS[backend]}…`)
  let answer: T
  if (backend === 'api') {
    answer = await requestViaApi(request, model)
  } else {
    answer = await requestViaCli(request, model)
  }
  return { answer, backend, model }
}
