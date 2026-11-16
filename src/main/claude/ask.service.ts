import Anthropic from '@anthropic-ai/sdk'
import { app } from 'electron'
import type { AskThread, BriefingRecord, PullDetail, ResolvedGuideline } from '@shared/types'
import { pickBackend, prContext } from './briefing.service'
import { fetchFileAt } from '../pulls/pull.service'
import { runWithInput } from '../common/shell.util'
import { store } from '../store/store.service'

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
    .map((l, i) => `${String(from + i).padStart(5)}| ${l}`)
    .join('\n')
  return { body, partial: from > 1 || to < lines.length, from, to, total: lines.length }
}

async function fileBlock(pr: PullDetail, thread: AskThread, ref: 'head' | 'base') {
  const file = pr.files.find((f) => f.path === thread.path)
  const path = ref === 'base' ? (file?.previousPath ?? thread.path) : thread.path
  const text = await fetchFileAt(pr.repo, ref === 'head' ? pr.headSha : pr.baseSha, path)
  if (text == null) return `<file path="${path}" ref="${ref}">(not available)</file>`
  const n = numbered(text, [thread.startLine, thread.endLine])
  const range = n.partial ? ` lines="${n.from}-${n.to} of ${n.total}"` : ''
  return `<file path="${path}" ref="${ref}"${range}>\n${n.body}\n</file>`
}

/** Stable per-thread context: identical on follow-ups, so the API can serve it from cache. */
async function buildContext(pr: PullDetail, guidelines: ResolvedGuideline[], briefing: BriefingRecord | undefined, thread: AskThread) {
  const { context } = prContext(pr, guidelines, 600_000)
  const files = [await fileBlock(pr, thread, 'head')]
  if (thread.side === 'LEFT') files.push(await fileBlock(pr, thread, 'base'))
  const gist = briefing ? `<briefing_gist>\n${briefing.briefing.intent}\n${briefing.briefing.gist}\n</briefing_gist>\n\n` : ''
  return `${context}\n\n${gist}<full_file_contents>\n${files.join('\n\n')}\n</full_file_contents>`
}

function selectionBlock(thread: AskThread) {
  const side = thread.side === 'LEFT' ? 'removed/old side (base line numbers)' : 'new side (head line numbers)'
  const lines = thread.startLine === thread.endLine ? `${thread.startLine}` : `${thread.startLine}-${thread.endLine}`
  return `<selection path="${thread.path}" lines="${lines}" side="${side}">\n${thread.snippet}\n</selection>`
}

export async function ask(
  pr: PullDetail,
  guidelines: ResolvedGuideline[],
  briefing: BriefingRecord | undefined,
  thread: AskThread,
  onDelta: (text: string) => void,
): Promise<string> {
  const context = await buildContext(pr, guidelines, briefing, thread)
  const model = store.settings().claudeModel
  const [first, ...rest] = thread.messages
  if (!first || first.role !== 'user') throw new Error('Ask thread must start with a question')

  if (pickBackend() === 'api') {
    const apiKey = store.anthropicKey()
    const client = new Anthropic(apiKey ? { apiKey } : {})
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
      max_tokens: 16000,
      system: SYSTEM,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages,
    })
    stream.on('text', (t) => onDelta(t))
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') throw new Error('Claude declined to answer this question.')
    return final.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  }

  // Claude Code CLI: one-shot prompt that replays the conversation so far.
  const transcript = thread.messages
    .map((m, i) => (i === 0 ? `<question>\n${m.content}\n</question>` : m.role === 'user' ? `<question>\n${m.content}\n</question>` : `<your_answer>\n${m.content}\n</your_answer>`))
    .join('\n\n')
  const prompt = `${context}\n\n${selectionBlock(thread)}\n\n<conversation>\n${transcript}\n</conversation>\n\nAnswer the last question.`
  let streamed = ''
  let buffer = ''
  let finalText: string | null = null
  await runWithInput(
    'claude',
    ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--model', model, '--tools', '', '--system-prompt', SYSTEM, '--no-session-persistence'],
    prompt,
    {
      cwd: app.getPath('temp'),
      timeoutMs: 10 * 60_000,
      onStdout: (chunk) => {
        buffer += chunk
        let nl: number
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (!line) continue
          try {
            const ev = JSON.parse(line) as {
              type: string
              event?: { type: string; delta?: { type: string; text?: string } }
              result?: string
              is_error?: boolean
            }
            if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta' && ev.event.delta.text) {
              streamed += ev.event.delta.text
              onDelta(ev.event.delta.text)
            }
            if (ev.type === 'result') {
              if (ev.is_error) throw new Error(ev.result || 'Claude Code returned an error')
              finalText = ev.result ?? null
            }
          } catch (e) {
            if (e instanceof Error && !(e instanceof SyntaxError)) throw e
          }
        }
      },
    },
  )
  return finalText ?? streamed
}
