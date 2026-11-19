import Anthropic from '@anthropic-ai/sdk'
import type { AskThread, BriefingRecord } from '@shared/claude.types.ts'
import type { ResolvedGuideline } from '@shared/guideline.types.ts'
import type { PullDetail } from '@shared/pull.types.ts'
import { app } from 'electron'
import { runWithInput } from '../common/shell.util.ts'
import { fetchFileAt } from '../pulls/pull.service.ts'
import { store } from '../store/store.service.ts'
import { pickBackend, prContext } from './briefing.service.ts'

const SYSTEM = `You are pairing with a code reviewer who is looking at one specific part of a pull request.
They selected some lines of the diff and asked a question about them. You have the full file at the PR's head
(and at the base when they selected removed lines), the whole PR diff, the PR description, and their review guides.

- Answer the question about the selected lines first, directly. Use the surrounding code and the rest of the PR
  to explain behavior, not just the syntax.
- Cite concrete line numbers and paths. Never invent code that is not in the context.
- If something is a real risk, say what input or state triggers it. If you are unsure, say what to check.
- When asked to draft a review comment, write it ready to paste: short, specific, kind; use a GitHub
  \`suggestion\` block only for a concrete replacement of the selected lines.
- Keep it compact: markdown, short paragraphs or bullets, no preamble.`

/** Whole files up to this many lines are sent; longer files get a window around the selection. */
const MAX_FILE_LINES = 3000
const WINDOW = 400
/** Width of the line-number column in numbered files. */
const LINE_NUMBER_WIDTH = 5
/** Characters of PR diff sent with a question; the files around the selection come on top. */
const DIFF_BUDGET_CHARS = 600_000
const MAX_ANSWER_TOKENS = 16_000
/** Ten minutes. */
const CLI_TIMEOUT_MS = 600_000

const SIDE_LABELS: Record<AskThread['side'], string> = {
  LEFT: 'removed/old side (base line numbers)',
  RIGHT: 'new side (head line numbers)',
}

/** What a question is about: the PR, the guides that apply, its briefing and the conversation so far. */
interface AskInput {
  pr: PullDetail
  guidelines: ResolvedGuideline[]
  briefing: BriefingRecord | undefined
  thread: AskThread
}

/** One line of `claude -p --output-format stream-json`; only the fields read here. */
interface CliStreamEvent {
  type: string
  event?: { type: string; delta?: { type: string; text?: string } }
  result?: string
  is_error?: boolean
}

function numbered(text: string, focus: [number, number]) {
  const lines = text.split('\n')
  let from = 1
  let to = lines.length
  if (lines.length > MAX_FILE_LINES) {
    from = Math.max(1, focus[0] - WINDOW)
    to = Math.min(lines.length, focus[1] + WINDOW)
  }
  const body = lines
    .slice(from - 1, to)
    .map((l, i) => `${String(from + i).padStart(LINE_NUMBER_WIDTH)}| ${l}`)
    .join('\n')
  return { body, partial: from > 1 || to < lines.length, from, to, total: lines.length }
}

/** Where the selected file lives on one side of the PR: its path there and the commit to read it at. */
function fileAtSide(pr: PullDetail, thread: AskThread, ref: 'head' | 'base') {
  if (ref === 'head') {
    return { path: thread.path, sha: pr.headSha }
  }
  const file = pr.files.find((f) => f.path === thread.path)
  return { path: file?.previousPath ?? thread.path, sha: pr.baseSha }
}

async function fileBlock(pr: PullDetail, thread: AskThread, ref: 'head' | 'base') {
  const { path, sha } = fileAtSide(pr, thread, ref)
  const text = await fetchFileAt(pr.repo, sha, path)
  if (text === null) {
    return `<file path="${path}" ref="${ref}">(not available)</file>`
  }
  const n = numbered(text, [thread.startLine, thread.endLine])
  let range = ''
  if (n.partial) {
    range = ` lines="${n.from}-${n.to} of ${n.total}"`
  }
  return `<file path="${path}" ref="${ref}"${range}>\n${n.body}\n</file>`
}

function briefingGist(briefing: BriefingRecord | undefined) {
  if (!briefing) {
    return ''
  }
  return `<briefing_gist>\n${briefing.briefing.intent}\n${briefing.briefing.gist}\n</briefing_gist>\n\n`
}

/** Stable per-thread context: identical on follow-ups, so the API can serve it from cache. */
async function buildContext({ pr, guidelines, briefing, thread }: AskInput) {
  const { context } = prContext(pr, guidelines, DIFF_BUDGET_CHARS)
  const files = [await fileBlock(pr, thread, 'head')]
  if (thread.side === 'LEFT') {
    files.push(await fileBlock(pr, thread, 'base'))
  }
  return `${context}\n\n${briefingGist(briefing)}<full_file_contents>\n${files.join('\n\n')}\n</full_file_contents>`
}

function selectionBlock(thread: AskThread) {
  let lines = `${thread.startLine}-${thread.endLine}`
  if (thread.startLine === thread.endLine) {
    lines = `${thread.startLine}`
  }
  return `<selection path="${thread.path}" lines="${lines}" side="${SIDE_LABELS[thread.side]}">\n${thread.snippet}\n</selection>`
}

async function askViaApi(context: string, thread: AskThread, model: string, onDelta: (text: string) => void) {
  const [first, ...rest] = thread.messages
  if (first?.role !== 'user') {
    throw new Error('Ask thread must start with a question')
  }
  const apiKey = store.anthropicKey()
  const client = new Anthropic({ ...(apiKey !== undefined && { apiKey }) })
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `${selectionBlock(thread)}\n\n${first.content}` },
      ],
    },
    ...rest.map((m) => ({ role: m.role, content: m.content })),
  ]
  const stream = client.beta.messages.stream({
    model,
    max_tokens: MAX_ANSWER_TOKENS,
    system: SYSTEM,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    messages,
  })
  stream.on('text', (t) => onDelta(t))
  const final = await stream.finalMessage()
  if (final.stop_reason === 'refusal') {
    throw new Error('Claude declined to answer this question.')
  }
  return final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

/** The conversation replayed for a one-shot CLI prompt; the first message is always a question. */
function transcriptOf(thread: AskThread) {
  return thread.messages
    .map((m) => {
      if (m.role === 'assistant') {
        return `<your_answer>\n${m.content}\n</your_answer>`
      }
      return `<question>\n${m.content}\n</question>`
    })
    .join('\n\n')
}

/** Splits complete lines off a growing stdout buffer; returns them and what is left. */
function takeLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split('\n')
  const rest = parts.pop() ?? ''
  return { lines: parts.map((l) => l.trim()).filter(Boolean), rest }
}

/** Parses one stream-json line; null for lines that are not JSON (Claude Code prints a few). */
function parseStreamEvent(line: string): CliStreamEvent | null {
  try {
    return JSON.parse(line) as CliStreamEvent
  } catch {
    return null
  }
}

/** The text a streaming event adds to the answer, or '' for other events. */
function deltaTextOf(ev: CliStreamEvent) {
  if (ev.type !== 'stream_event' || ev.event?.type !== 'content_block_delta' || ev.event.delta?.type !== 'text_delta') {
    return ''
  }
  return ev.event.delta.text ?? ''
}

async function askViaCli(context: string, thread: AskThread, model: string, onDelta: (text: string) => void) {
  const prompt = `${context}\n\n${selectionBlock(thread)}\n\n<conversation>\n${transcriptOf(thread)}\n</conversation>\n\nAnswer the last question.`
  let streamed = ''
  let buffer = ''
  let finalText: string | null = null
  const onEvent = (ev: CliStreamEvent) => {
    const delta = deltaTextOf(ev)
    if (delta) {
      streamed += delta
      onDelta(delta)
    }
    if (ev.type === 'result' && ev.is_error) {
      throw new Error(ev.result || 'Claude Code returned an error')
    }
    if (ev.type === 'result') {
      finalText = ev.result ?? null
    }
  }
  await runWithInput(
    'claude',
    [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--model',
      model,
      '--tools',
      '',
      '--system-prompt',
      SYSTEM,
      '--no-session-persistence',
    ],
    prompt,
    {
      cwd: app.getPath('temp'),
      timeoutMs: CLI_TIMEOUT_MS,
      onStdout: (chunk) => {
        const { lines, rest } = takeLines(buffer + chunk)
        buffer = rest
        for (const ev of lines.map(parseStreamEvent)) {
          if (ev) {
            onEvent(ev)
          }
        }
      },
    },
  )
  return finalText ?? streamed
}

/** Answers the last question of `input.thread`, streaming the answer's text through `onDelta`. */
export async function ask(input: AskInput, onDelta: (text: string) => void): Promise<string> {
  const context = await buildContext(input)
  const model = store.settings().claudeModel
  if (pickBackend() === 'api') {
    return askViaApi(context, input.thread, model, onDelta)
  }
  return askViaCli(context, input.thread, model, onDelta)
}
