import type { Octokit } from '@octokit/rest'
import type { FileExplanation, FileExplanationRecord } from '@shared/explanation.types.ts'
import type { PullDetail, PullFile } from '@shared/pull.types.ts'
import { z } from 'zod'
import { splitRepo } from '../github/repo-name.util.ts'
import { requestJson } from './claude-json.service.ts'

const ExplanationSchema = z.object({
  purpose: z.string().describe('2-3 sentences: what this code is for and who uses it, in plain words.'),
  howItWorks: z
    .string()
    .describe('Markdown, short: the main parts of the file and how control and data flow through them.'),
  connections: z
    .array(z.object({ path: z.string(), relation: z.string().describe('e.g. "calls this", "is called by", "tests"') }))
    .describe('Only paths listed in the request. Most important first, at most 6.'),
  change: z.string().describe('What this PR changes in the file and why, as far as the PR says. Markdown allowed.'),
  watchFor: z
    .array(z.string())
    .describe('2-4 things a reviewer new to this code should check, given how it works. Specific, not generic.'),
})

const SYSTEM = `You help a code reviewer who does not know this part of the codebase.
Before they judge a change, explain the code it changes: what it is for, how it works, what it is connected to, and
what the change does to it. Teach, briefly: the reviewer should come away understanding the code, not just the diff.
Be concrete and terse. Only name files that appear in the request. Never invent behaviour you cannot see; when you
infer, say so.`

const MAX_EXPLANATION_TOKENS = 8000
/** The most of the file sent along: about 30k tokens. */
const FILE_BUDGET_CHARS = 120_000
/** Files listed from the file's folder, and files found mentioning it. */
const MAX_NEIGHBOURS = 40
const MAX_REFERENCES = 10
const EXTENSION = /\.[^.]+$/u

/** The files next to `path` at `ref`, or none when GitHub would not say. */
async function listNeighbours(octokit: Octokit, repoName: string, ref: string, path: string) {
  const { owner, repo } = splitRepo(repoName)
  const folder = path.slice(0, Math.max(0, path.lastIndexOf('/')))
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: folder, ref })
    if (!Array.isArray(data)) {
      return []
    }
    return data
      .map((entry) => entry.path)
      .filter((entry) => entry !== path)
      .slice(0, MAX_NEIGHBOURS)
  } catch {
    return []
  }
}

/** Files on the default branch that mention the file's name, likely its callers; none when search is refused. */
async function findReferences(octokit: Octokit, repoName: string, path: string) {
  const name = (path.split('/').at(-1) ?? path).replace(EXTENSION, '')
  try {
    const { data } = await octokit.search.code({ q: `"${name}" repo:${repoName}`, per_page: MAX_REFERENCES + 1 })
    return data.items.map((item) => item.path).filter((found) => found !== path)
  } catch {
    return []
  }
}

/** Everything Claude gets: the PR, the file whole, its diff, and the files around it. */
export function buildExplainPrompt(input: {
  pr: PullDetail
  file: PullFile
  content: string | null
  neighbours: string[]
  references: string[]
}) {
  const { pr, file } = input
  let content = '(not available: binary, too large, or removed)'
  if (input.content !== null) {
    content = input.content.slice(0, FILE_BUDGET_CHARS)
  }
  return `<pull_request repo="${pr.repo}" number="${pr.number}">
<title>${pr.title}</title>
<description>
${pr.body || '(no description)'}
</description>
</pull_request>

<file path="${file.path}" status="${file.status}">
${content}
</file>

<diff path="${file.path}">
${file.patch ?? '(no diff: binary or too large)'}
</diff>

<files_in_same_folder>
${input.neighbours.join('\n') || '(none)'}
</files_in_same_folder>

<files_mentioning_it reason="code search on the default branch for the file's name">
${input.references.join('\n') || '(none found)'}
</files_mentioning_it>

Explain ${file.path} to me before I review its change, using the required JSON format.`
}

/** Claude's explanation of one file of the PR, for a reviewer who does not know that code. */
export async function explainFile(deps: {
  octokit: Octokit
  pr: PullDetail
  path: string
  loadFile: (repo: string, ref: string, path: string) => Promise<string | null>
  onProgress: (message: string) => void
}): Promise<FileExplanationRecord> {
  const { octokit, pr, path } = deps
  const file = pr.files.find((candidate) => candidate.path === path)
  if (!file) {
    throw new Error(`${path} is not in this PR.`)
  }
  deps.onProgress('Reading the file and the code around it…')
  const [content, neighbours, references] = await Promise.all([
    deps.loadFile(pr.repo, pr.headSha, path).catch(() => null),
    listNeighbours(octokit, pr.repo, pr.headSha, path),
    findReferences(octokit, pr.repo, path),
  ])
  const { answer, model } = await requestJson<FileExplanation>({
    schema: ExplanationSchema,
    system: SYSTEM,
    prompt: buildExplainPrompt({ pr, file, content, neighbours, references }),
    maxTokens: MAX_EXPLANATION_TOKENS,
    effort: 'low',
    noun: 'explanation',
    onProgress: deps.onProgress,
  })
  return { headSha: pr.headSha, createdAt: new Date().toISOString(), model, explanation: answer }
}
