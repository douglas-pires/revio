import type { Guideline } from '@shared/guideline.types.ts'
import type { PullSummary } from '@shared/inbox.types.ts'
import type { PullDetail, PullFile } from '@shared/pull.types.ts'
import type { MiniPr } from '../src/main/stacks/stack-graph.util.ts'

export function makeSummary(over: Partial<PullSummary> = {}): PullSummary {
  return {
    id: 'PR_1',
    number: 1,
    title: 'Add thing',
    url: 'https://github.com/acme/web/pull/1',
    repo: 'acme/web',
    author: 'ana',
    authorAvatar: '',
    isDraft: false,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    requestedAt: '2026-11-01T10:00:00Z',
    viaTeam: null,
    additions: 1,
    deletions: 0,
    changedFiles: 1,
    headRef: 'feature',
    baseRef: 'main',
    reviewDecision: null,
    defaultBranch: 'main',
    stale: false,
    waitingHours: 1,
    ...over,
  }
}

export function makeFile(over: Partial<PullFile> = {}): PullFile {
  return {
    path: 'src/a.ts',
    sha: 'sha1',
    status: 'modified',
    additions: 1,
    deletions: 0,
    patch: '@@ -1,1 +1,2 @@\n a\n+b',
    ...over,
  }
}

export function makeDetail(over: Partial<PullDetail> = {}): PullDetail {
  return {
    fetchedAt: '2026-11-01T10:00:00Z',
    repo: 'acme/web',
    number: 1,
    title: 'Add thing',
    body: '',
    url: 'https://github.com/acme/web/pull/1',
    author: 'ana',
    authorAvatar: '',
    headRef: 'feature',
    baseRef: 'main',
    headSha: 'h',
    baseSha: 'b',
    viewer: 'me',
    myReview: null,
    lastReviewedAt: null,
    isDraft: false,
    additions: 1,
    deletions: 0,
    commitCount: 1,
    files: [makeFile()],
    comments: [],
    threads: [],
    ...over,
  }
}

/** An open PR as GitHub's GraphQL returns it for stack detection. */
export function makeMiniPr(number: number, head: string, base: string, repo = 'acme/web'): MiniPr {
  return {
    id: `PR_${number}`,
    number,
    title: `PR ${number}`,
    url: '',
    isDraft: false,
    headRefName: head,
    baseRefName: base,
    reviewDecision: null,
    author: { login: 'ana', avatarUrl: '' },
    repository: { nameWithOwner: repo, defaultBranchRef: { name: 'main' } },
  }
}

export function makeGuideline(id: string, repo: string, path = '', enabled = true): Guideline {
  return { id, repo, path, title: id, body: '', enabled, updatedAt: '' }
}

/** The value, or a failed test saying what was missing; use instead of a non-null assertion. */
export function expectPresent<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected a ${what}, got ${String(value)}`)
  }
  return value
}
