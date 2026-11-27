import type { Briefing, BriefingRecord } from '@shared/claude.types.ts'
import type { ResolvedGuideline } from '@shared/guideline.types.ts'
import type { PullDetail } from '@shared/pull.types.ts'
import { z } from 'zod'
import { describeScope } from '../guidelines/guidelines.service.ts'
import { requestJson } from './claude-json.service.ts'

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
const MAX_BRIEFING_TOKENS = 16_000
/** The most recent review comments sent along, each cut to COMMENT_CHARS. */
const RECENT_COMMENTS = 60
const COMMENT_CHARS = 400

function buildPrompt(pr: PullDetail, guidelines: ResolvedGuideline[]) {
  const { context, omitted } = buildPrContext(pr, guidelines)
  return { prompt: `${context}\n\nBrief me on this pull request using the required JSON format.`, omitted }
}

/** Which diffs fit the budget, smallest first so one huge generated file cannot crowd out the real changes. */
function budgetDiffs(pr: PullDetail, budget: number) {
  const omitted: string[] = []
  const included = new Set<string>()
  let used = 0
  for (const file of [...pr.files].sort((left, right) => (left.patch?.length ?? 0) - (right.patch?.length ?? 0))) {
    const size = file.patch?.length ?? 0
    if (file.patch && used + size <= budget) {
      used += size
      included.add(file.path)
    } else {
      omitted.push(file.path)
    }
  }
  return { included, omitted }
}

function buildGuidelinesText(guidelines: ResolvedGuideline[]) {
  if (guidelines.length === 0) {
    return '(none configured)'
  }
  return guidelines
    .map(
      (guideline) =>
        `<guideline title="${guideline.title}" scope="${describeScope(guideline)}">\n${guideline.body}\n</guideline>`,
    )
    .join('\n\n')
}

function describeFile(file: PullDetail['files'][number]) {
  let renamed = ''
  if (file.previousPath) {
    renamed = ` (from ${file.previousPath})`
  }
  return `- ${file.status} ${file.path}${renamed} +${file.additions}/-${file.deletions}`
}

function describeComment(comment: PullDetail['comments'][number]) {
  let line = ''
  if (comment.line) {
    line = `:${comment.line}`
  }
  return `- ${comment.author} on ${comment.path}${line}: ${comment.body.slice(0, COMMENT_CHARS)}`
}

/** An XML-ish section of the prompt, or nothing when it would be empty. */
function buildOptionalSection(tag: string, body: string, attributes = '') {
  if (!body) {
    return ''
  }
  return `<${tag}${attributes}>\n${body}\n</${tag}>\n`
}

/** Guidelines + PR metadata + budgeted diffs, shared by the briefing and Ask Claude. */
export function buildPrContext(pr: PullDetail, guidelines: ResolvedGuideline[], budget = DIFF_BUDGET_CHARS) {
  const { included, omitted } = budgetDiffs(pr, budget)
  const fileList = pr.files.map(describeFile).join('\n')
  const diffs = pr.files
    .filter((file) => included.has(file.path))
    .map((file) => `<file path="${file.path}" status="${file.status}">\n${file.patch}\n</file>`)
    .join('\n\n')
  const discussion = pr.comments.slice(-RECENT_COMMENTS).map(describeComment).join('\n')
  const omittedSection = buildOptionalSection(
    'omitted_diffs',
    omitted.join('\n'),
    ' reason="binary, too large, or over the size budget"',
  )
  const prompt = `<reviewer_guidelines>
${buildGuidelinesText(guidelines)}
</reviewer_guidelines>

<pull_request repo="${pr.repo}" number="${pr.number}" author="${pr.author}" base="${pr.baseRef}" head="${pr.headRef}">
<title>${pr.title}</title>
<description>
${pr.body || '(no description)'}
</description>
<changed_files count="${pr.files.length}">
${fileList}
</changed_files>
${omittedSection}${buildOptionalSection('existing_review_comments', discussion)}<diff>
${diffs}
</diff>
</pull_request>`
  return { context: prompt, omitted }
}

export async function generateBriefing(
  pr: PullDetail,
  guidelines: ResolvedGuideline[],
  onProgress: (message: string) => void,
): Promise<BriefingRecord> {
  const { prompt, omitted } = buildPrompt(pr, guidelines)
  const { answer, backend, model } = await requestJson<Briefing>({
    schema: BriefingSchema,
    system: SYSTEM,
    prompt,
    maxTokens: MAX_BRIEFING_TOKENS,
    effort: 'medium',
    noun: 'briefing',
    onProgress,
  })
  return {
    headSha: pr.headSha,
    createdAt: new Date().toISOString(),
    backend,
    model,
    briefing: answer,
    omittedFiles: omitted,
  }
}
