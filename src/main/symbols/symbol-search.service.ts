import type { Octokit } from '@octokit/rest'
import type { PullDetail } from '@shared/pull.types.ts'
import type { SymbolHit, SymbolSearch } from '@shared/symbol.types.ts'
import { isSearchableName, scanFile, sortHits } from './symbol-scan.util.ts'

/** The PR's files read at most, and files from elsewhere in the repository. */
const MAX_PULL_FILES = 80
const MAX_OTHER_FILES = 15
/** Files read at once. */
const READ_BATCH = 8
const MAX_HITS = 200
/** What GitHub answers when code search is used too often: forbidden, or too many requests. */
const FORBIDDEN = 403
const TOO_MANY_REQUESTS = 429
const RATE_LIMITED = new Set([FORBIDDEN, TOO_MANY_REQUESTS])

type LoadFile = (repo: string, ref: string, path: string) => Promise<string | null>

/** Reads `paths` at the PR's head a few at a time, and scans each for the name. */
async function scanFiles(
  pr: PullDetail,
  paths: readonly string[],
  search: { name: string; inPull: boolean; loadFile: LoadFile },
) {
  const { name, inPull, loadFile } = search
  const hits: SymbolHit[] = []
  for (let start = 0; start < paths.length; start += READ_BATCH) {
    const batch = paths.slice(start, start + READ_BATCH)
    // A few at a time, to keep GitHub's limits in mind.
    const contents = await Promise.all(batch.map((path) => loadFile(pr.repo, pr.headSha, path).catch(() => null)))
    for (const [index, content] of contents.entries()) {
      const path = batch[index]
      if (content !== null && path !== undefined) {
        hits.push(...scanFile(path, content, name, inPull))
      }
    }
  }
  return hits
}

/** Files elsewhere in the repository that mention the name, by GitHub code search (on the default branch). */
async function searchRepository(octokit: Octokit, pr: PullDetail, name: string, skip: ReadonlySet<string>) {
  const { data } = await octokit.search.code({ q: `${name} repo:${pr.repo}`, per_page: MAX_OTHER_FILES * 2 })
  return [...new Set(data.items.map((item) => item.path))].filter((path) => !skip.has(path)).slice(0, MAX_OTHER_FILES)
}

/** Why the rest of the repository could not be searched, said plainly. */
function describeSearchFailure(failure: unknown) {
  if (failure instanceof Error && 'status' in failure && RATE_LIMITED.has(Number(failure.status))) {
    return 'GitHub limits code search to a few searches a minute; only the PR’s files were searched. Try again shortly.'
  }
  return 'GitHub code search did not answer; only the PR’s files were searched.'
}

/**
 * Where a name is defined and used: every file the PR changes, read at its head, then files elsewhere in the
 * repository that GitHub code search finds (it searches the default branch; the lines shown are read at the head).
 */
export async function findSymbol(deps: {
  octokit: Octokit
  pr: PullDetail
  name: string
  loadFile: LoadFile
}): Promise<SymbolSearch> {
  const { octokit, pr, name, loadFile } = deps
  if (!isSearchableName(name)) {
    throw new Error(`“${name}” is not a name that can be searched.`)
  }
  const pullPaths = pr.files.filter((file) => file.status !== 'removed').map((file) => file.path)
  const hits = await scanFiles(pr, pullPaths.slice(0, MAX_PULL_FILES), { name, inPull: true, loadFile })
  let note: string | null = null
  try {
    const others = await searchRepository(octokit, pr, name, new Set(pullPaths))
    hits.push(...(await scanFiles(pr, others, { name, inPull: false, loadFile })))
  } catch (failure) {
    note = describeSearchFailure(failure)
  }
  if (hits.length > MAX_HITS && note === null) {
    note = `Showing the first ${MAX_HITS} of ${hits.length} lines.`
  }
  return { name, hits: sortHits(hits).slice(0, MAX_HITS), note }
}
