import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { app } from 'electron'
import { z } from 'zod'
import type { Briefing, BriefingRecord } from '@shared/claude.types'
import type { ResolvedGuideline } from '@shared/guideline.types'
import type { PullDetail } from '@shared/pull.types'
import { scopeLabel } from '../guidelines/guidelines.service'
import { runWithInput } from '../common/shell.util'
import { store } from '../store/store.service'

const BriefingSchema = z.object({
  gist: z.string().describe('2-4 sentences, markdown allowed: what this PR does and why, in plain words.'),
  intent: z.string().describe('One line: the author goal / problem being solved.'),
  risk: z.enum(['low', 'medium', 'high']),
  focus: z
    .array(
      z.object({
        path: z.string(),
        lines: z.string().describe('Line range on the new side, e.g. "42-80", or "" for the whole file.'),
        reason: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
      }),
    )
    .describe('Where the reviewer should spend attention, most important first.'),
  ignore: z
    .array(z.object({ path: z.string(), reason: z.string() }))
    .describe('Files that are safe to skim or skip (generated, lockfiles, mechanical renames, snapshots...).'),
  concerns: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        path: z.string(),
        line: z.number().int().nullable().describe('Line on the new (RIGHT) side, or null.'),
      }),
    )
    .describe('Concrete potential problems worth checking. Only real, specific issues - no filler.'),
  questions: z.array(z.string()).describe('Questions worth asking the author.'),
  guidelineChecks: z.array(
    z.object({
      guideline: z.string().describe('Title of the reviewer guideline.'),
      status: z.enum(['ok', 'concern', 'unclear']),
      note: z.string(),
    }),
  ),
})

const SYSTEM = `You prepare a code reviewer before they open a pull request.
Your job is triage, not the review itself: tell the reviewer what the PR is about, where their attention pays off,
and what they can safely skip. The reviewer has written guidelines describing what matters to them; apply them,
and let more specific (folder-level) guidelines override general ones for the files they cover.
Be concrete and terse. Reference real paths from the diff. Never invent files or line numbers.
If a concern is speculative, say what to verify rather than asserting a bug.`

/** ~4 chars/token; leaves plenty of headroom in a 1M context window. */
const DIFF_BUDGET_CHARS = 1_200_000

/** Guidelines + PR metadata + budgeted diffs, shared by the briefing and Ask Claude. */
export function prContext(pr: PullDetail, guidelines: ResolvedGuideline[], budget = DIFF_BUDGET_CHARS) {
  const omitted: string[] = []
  let used = 0
  const included = new Set<string>()
  // Smallest diffs first so one huge generated file cannot crowd out the real changes.
  for (const f of [...pr.files].sort((a, b) => (a.patch?.length ?? 0) - (b.patch?.length ?? 0))) {
    if (!f.patch) {
      omitted.push(f.path)
      continue
    }
    if (used + f.patch.length > budget) {
      omitted.push(f.path)
      continue
    }
    used += f.patch.length
    included.add(f.path)
  }

  const guidelineText = guidelines.length
    ? guidelines
        .map((g) => `<guideline title="${g.title}" scope="${scopeLabel(g)}">\n${g.body}\n</guideline>`)
        .join('\n\n')
    : '(none configured)'

  const fileList = pr.files
    .map((f) => `- ${f.status} ${f.path}${f.previousPath ? ` (from ${f.previousPath})` : ''} +${f.additions}/-${f.deletions}`)
    .join('\n')

  const diffs = pr.files
    .filter((f) => included.has(f.path))
    .map((f) => `<file path="${f.path}" status="${f.status}">\n${f.patch}\n</file>`)
    .join('\n\n')

  const discussion = pr.comments
    .slice(-60)
    .map((c) => `- ${c.author} on ${c.path}${c.line ? `:${c.line}` : ''}: ${c.body.slice(0, 400)}`)
    .join('\n')

  const prompt = `<reviewer_guidelines>
${guidelineText}
</reviewer_guidelines>

<pull_request repo="${pr.repo}" number="${pr.number}" author="${pr.author}" base="${pr.baseRef}" head="${pr.headRef}">
<title>${pr.title}</title>
<description>
${pr.body || '(no description)'}
</description>
<changed_files count="${pr.files.length}">
${fileList}
</changed_files>
${omitted.length ? `<omitted_diffs reason="binary, too large, or over the size budget">\n${omitted.join('\n')}\n</omitted_diffs>\n` : ''}${discussion ? `<existing_review_comments>\n${discussion}\n</existing_review_comments>\n` : ''}<diff>
${diffs}
</diff>
</pull_request>`
  return { context: prompt, omitted }
}

function buildPrompt(pr: PullDetail, guidelines: ResolvedGuideline[]) {
  const { context, omitted } = prContext(pr, guidelines)
  return { prompt: `${context}\n\nBrief me on this pull request using the required JSON format.`, omitted }
}

export function pickBackend(): 'api' | 'cli' {
  const s = store.settings()
  if (s.claudeBackend !== 'auto') return s.claudeBackend
  return store.anthropicKey() || process.env.ANTHROPIC_API_KEY ? 'api' : 'cli'
}

async function viaApi(prompt: string, model: string): Promise<Briefing> {
  const apiKey = store.anthropicKey()
  const client = new Anthropic(apiKey ? { apiKey } : {})
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: betaZodOutputFormat(BriefingSchema) },
    messages: [{ role: 'user', content: prompt }],
  })
  if (response.stop_reason === 'refusal') throw new Error('Claude declined to brief this PR.')
  if (response.stop_reason === 'max_tokens') throw new Error('Briefing was cut off (max_tokens). Try again.')
  if (!response.parsed_output) throw new Error('Claude returned an unparseable briefing.')
  return response.parsed_output
}

async function viaCli(prompt: string, model: string, onProgress: (m: string) => void): Promise<Briefing> {
  // The CLI's validator does not know the draft-2020 meta-schema tag Zod emits.
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(BriefingSchema, { target: 'draft-7' })
  const schema = JSON.stringify(jsonSchema)
  const out = await runWithInput(
    'claude',
    [
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      schema,
      '--model',
      model,
      '--tools',
      '',
      '--system-prompt',
      SYSTEM,
      '--no-session-persistence',
    ],
    prompt,
    { cwd: app.getPath('temp'), timeoutMs: 10 * 60_000, onStderr: (l) => onProgress(l.trim().slice(0, 200)) },
  )
  const result = JSON.parse(out) as { is_error?: boolean; result?: string; structured_output?: unknown }
  if (result.is_error) throw new Error(result.result || 'Claude Code returned an error')
  const payload = result.structured_output ?? JSON.parse(extractJson(result.result ?? ''))
  return BriefingSchema.parse(payload)
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) return fenced[1]
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start >= 0 && end > start ? text.slice(start, end + 1) : text
}

export async function generateBriefing(
  pr: PullDetail,
  guidelines: ResolvedGuideline[],
  onProgress: (m: string) => void,
): Promise<BriefingRecord> {
  const { prompt, omitted } = buildPrompt(pr, guidelines)
  const backend = pickBackend()
  const model = store.settings().claudeModel
  onProgress(backend === 'api' ? `Asking ${model} via the Anthropic API…` : `Asking ${model} via Claude Code…`)
  const briefing = backend === 'api' ? await viaApi(prompt, model) : await viaCli(prompt, model, onProgress)
  return { headSha: pr.headSha, createdAt: new Date().toISOString(), backend, model, briefing, omittedFiles: omitted }
}
