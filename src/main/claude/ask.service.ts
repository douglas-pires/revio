import Anthropic from '@anthropic-ai/sdk'
import type { AskThread, BriefingRecord } from '@shared/claude.types.ts'
import type { ResolvedGuideline } from '@shared/guideline.types.ts'
import type { PullDetail } from '@shared/pull.types.ts'
import { app } from 'electron'
import { runWithInput } from '../common/shell.util.ts'
import { fetchFileAt } from '../pulls/pull.service.ts'
import { store } from '../store/store.service.ts'
import { type AnswerStream, type AskStream, answerStream } from './ask-activity.util.ts'
import { buildMessageText, buildQuestionText, buildSelectionBlock } from './ask-prompt.util.ts'
import { buildPrContext, pickBackend } from './briefing.service.ts'

const SYSTEM = `You are pairing with a code reviewer who is looking at one specific part of a pull request.
They selected some lines of the diff and asked a question about them. You have the full file at the PR's head
(and at the base when they selected removed lines), the whole PR diff, the PR description, and their review guides.

- Answer the question about the selected lines first, directly. Use the surrounding code and the rest of the PR
  to explain behavior, not just the syntax.
- Cite concrete line numbers and paths. Never invent code that is not in the context.
- If something is a real risk, say what input or state triggers it. If you are unsure, say what to check.
- When asked to draft a review comment, write it ready to paste: short, specific, kind; use a GitHub
  \`suggestion\` block only for a concrete replacement of the selected lines.
- The reviewer may add more parts of the diff to a later question (\`added_selection\`): take them into account
  with the original selection, and say which part you mean when it matters.
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
  event?: { type: string; delta?: { type: string; text?: string; thinking?: string } }
  result?: string
  is_error?: boolean
}

function numberCodeLines(text: string, focus: [number, number]) {
  const lines = text.split('\n')
  let from = 1
  let to = lines.length
  if (lines.length > MAX_FILE_LINES) {
    from = Math.max(1, focus[0] - WINDOW)
    to = Math.min(lines.length, focus[1] + WINDOW)
  }
  const body = lines
    .slice(from - 1, to)
    .map((line, index) => `${String(from + index).padStart(LINE_NUMBER_WIDTH)}| ${line}`)
    .join('\n')
  return { body, partial: from > 1 || to < lines.length, from, to, total: lines.length }
}

/** Where the selected file lives on one side of the PR: its path there and the commit to read it at. */
function findFileAtSide(pr: PullDetail, thread: AskThread, ref: 'head' | 'base') {
  if (ref === 'head') {
    return { path: thread.path, sha: pr.headSha }
  }
  const file = pr.files.find((changedFile) => changedFile.path === thread.path)
  return { path: file?.previousPath ?? thread.path, sha: pr.baseSha }
}

async function buildFileBlock(pr: PullDetail, thread: AskThread, ref: 'head' | 'base', stream: AskStream) {
  const { path, sha } = findFileAtSide(pr, thread, ref)
  stream.onActivity({ kind: 'step', label: `Reading ${path} at the PR's ${ref}` })
  const text = await fetchFileAt(pr.repo, sha, path)
  if (text === null) {
    return `<file path="${path}" ref="${ref}">(not available)</file>`
  }
  const numberedCode = numberCodeLines(text, [thread.startLine, thread.endLine])
  let range = ''
  if (numberedCode.partial) {
    range = ` lines="${numberedCode.from}-${numberedCode.to} of ${numberedCode.total}"`
  }
  return `<file path="${path}" ref="${ref}"${range}>\n${numberedCode.body}\n</file>`
}

function describeBriefingGist(briefing: BriefingRecord | undefined) {
  if (!briefing) {
    return ''
  }
  return `<briefing_gist>\n${briefing.briefing.intent}\n${briefing.briefing.gist}\n</briefing_gist>\n\n`
}

/** Stable per-thread context: identical on follow-ups, so the API can serve it from cache. */
async function buildContext({ pr, guidelines, briefing, thread }: AskInput, stream: AskStream) {
  const { context } = buildPrContext(pr, guidelines, DIFF_BUDGET_CHARS)
  const files = [await buildFileBlock(pr, thread, 'head', stream)]
  if (thread.side === 'LEFT') {
    files.push(await buildFileBlock(pr, thread, 'base', stream))
  }
  return `${context}\n\n${describeBriefingGist(briefing)}<full_file_contents>\n${files.join('\n\n')}\n</full_file_contents>`
}

async function askViaApi(context: string, thread: AskThread, model: string, answer: AnswerStream) {
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
        { type: 'text', text: `${buildSelectionBlock(thread)}\n\n${buildQuestionText(first)}` },
      ],
    },
    ...rest.map((message) => ({ role: message.role, content: buildMessageText(message) })),
  ]
  const stream = client.beta.messages.stream({
    model,
    max_tokens: MAX_ANSWER_TOKENS,
    system: SYSTEM,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // Summarised reasoning streams to the chat, so it can show what Claude is working through.
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: 'medium' },
    messages,
  })
  stream.on('thinking', (delta) => answer.thinking(delta))
  stream.on('text', (text) => answer.text(text))
  const final = await stream.finalMessage()
  if (final.stop_reason === 'refusal') {
    throw new Error('Claude declined to answer this question.')
  }
  return final.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

/** The conversation replayed for a one-shot CLI prompt; the first message is always a question. */
function buildTranscript(thread: AskThread) {
  return thread.messages
    .map((message) => {
      if (message.role === 'assistant') {
        return `<your_answer>\n${message.content}\n</your_answer>`
      }
      return `<question>\n${buildQuestionText(message)}\n</question>`
    })
    .join('\n\n')
}

/** Splits complete lines off a growing stdout buffer; returns them and what is left. */
function takeLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split('\n')
  const rest = parts.pop() ?? ''
  return { lines: parts.map((part) => part.trim()).filter(Boolean), rest }
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
function readDeltaText(event: CliStreamEvent) {
  if (
    event.type !== 'stream_event' ||
    event.event?.type !== 'content_block_delta' ||
    event.event.delta?.type !== 'text_delta'
  ) {
    return ''
  }
  return event.event.delta.text ?? ''
}

/** Reasoning text in a CLI stream event, when Claude Code passes it on. */
function readDeltaThinking(event: CliStreamEvent) {
  if (
    event.type !== 'stream_event' ||
    event.event?.type !== 'content_block_delta' ||
    event.event.delta?.type !== 'thinking_delta'
  ) {
    return ''
  }
  return event.event.delta.thinking ?? ''
}

async function askViaCli(context: string, thread: AskThread, model: string, answer: AnswerStream) {
  const prompt = `${context}\n\n${buildSelectionBlock(thread)}\n\n<conversation>\n${buildTranscript(thread)}\n</conversation>\n\nAnswer the last question.`
  let streamed = ''
  let buffer = ''
  let finalText: string | null = null
  const onEvent = (event: CliStreamEvent) => {
    const thinking = readDeltaThinking(event)
    if (thinking) {
      answer.thinking(thinking)
    }
    const delta = readDeltaText(event)
    if (delta) {
      streamed += delta
      answer.text(delta)
    }
    if (event.type === 'result' && event.is_error) {
      throw new Error(event.result || 'Claude Code returned an error')
    }
    if (event.type === 'result') {
      finalText = event.result ?? null
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
        for (const event of lines.map(parseStreamEvent)) {
          if (event) {
            onEvent(event)
          }
        }
      },
    },
  )
  return finalText ?? streamed
}

/** The backends by name, as the chat says which one answers. */
const BACKEND_LABELS = { api: 'the Claude API', cli: 'Claude Code' } as const

/** Answers the last question of `input.thread`, streaming the answer and what Claude is doing through `out`. */
export async function ask(input: AskInput, stream: AskStream): Promise<string> {
  const context = await buildContext(input, stream)
  const model = store.settings().claudeModel
  const backend = pickBackend()
  stream.onActivity({ kind: 'step', label: `Asking ${model} through ${BACKEND_LABELS[backend]}` })
  const answer = answerStream(stream)
  if (backend === 'api') {
    return askViaApi(context, input.thread, model, answer)
  }
  return askViaCli(context, input.thread, model, answer)
}
