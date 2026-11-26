import type { MissLesson } from '@shared/learn.types.ts'
import type { PullDetail } from '@shared/pull.types.ts'
import { z } from 'zod'
import { requestJson } from '../claude/claude-json.service.ts'

const LessonSchema = z.object({
  whatWentWrong: z.string().describe('1-2 sentences: what the fix had to correct in the original PR.'),
  couldReviewCatch: z
    .enum(['yes', 'maybe', 'no'])
    .describe(
      'Could a careful reviewer of the original diff have seen it? "no" when it needed knowledge the diff lacked.',
    ),
  clue: z
    .string()
    .describe('Where in the original diff the sign was (file and what to notice), or why there was none.'),
  path: z.string().nullable().describe('The original PR file the clue is in, or null.'),
  lesson: z
    .string()
    .describe('One sentence to remember, phrased as something to check in future reviews. Specific, not "test more".'),
})

const SYSTEM = `You help a code reviewer learn from a bug that got past their review.
You get a pull request they approved and a later pull request that fixed something in it. Work out what went wrong,
whether a careful reviewer could have seen it in the original diff, and the lesson worth keeping.
Be fair: some bugs only show up in production or need context the diff did not have; say so plainly.
Be concrete and short. Reference real files from the diffs. Never invent code you cannot see.`

const MAX_LESSON_TOKENS = 4000
/** Each PR's diffs are cut to this many characters: about 50k tokens. */
const DIFF_BUDGET_CHARS = 200_000

/** A PR's title, description and diffs, within the budget. */
function describePull(tag: string, pr: PullDetail) {
  let remaining = DIFF_BUDGET_CHARS
  const diffs: string[] = []
  for (const file of pr.files) {
    const patch = file.patch ?? '(no diff: binary or too large)'
    if (patch.length <= remaining) {
      remaining -= patch.length
      diffs.push(`<file path="${file.path}">\n${patch}\n</file>`)
    } else {
      diffs.push(`<file path="${file.path}" omitted="over the size budget" />`)
    }
  }
  return `<${tag} repo="${pr.repo}" number="${pr.number}" author="${pr.author}">
<title>${pr.title}</title>
<description>
${pr.body || '(no description)'}
</description>
${diffs.join('\n')}
</${tag}>`
}

export function buildLessonPrompt(original: PullDetail, fix: PullDetail) {
  return `${describePull('approved_pull_request', original)}

${describePull('later_fix', fix)}

I approved the first pull request. What could my review have caught? Use the required JSON format.`
}

/** What a later fix says about the review that approved the original PR. */
export async function writeMissLesson(original: PullDetail, fix: PullDetail): Promise<MissLesson> {
  const { answer } = await requestJson<MissLesson>({
    schema: LessonSchema,
    system: SYSTEM,
    prompt: buildLessonPrompt(original, fix),
    maxTokens: MAX_LESSON_TOKENS,
    effort: 'medium',
    noun: 'lesson',
    onProgress: () => undefined,
  })
  return answer
}
