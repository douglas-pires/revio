import type { ApprovedPull, FollowUp } from '@shared/learn.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'

/** A fix this long after the approved PR merged is no longer checked for rewriting its lines. */
const FOLLOW_UP_DAYS = 60
const FIX_TITLE = /\b(?:fix(?:e[ds])?|bug|hotfix|revert(?:s|ed)?|regression|broken|crash(?:es)?)\b/iu
const REVERT_TITLE = /^revert\b/iu
/** Files too shared for changing both to mean anything. */
const NOISE_FILES = /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock|package\.json|CHANGELOG\.md|.+\.snap)$/u
/** Words that, right before a reference to the approved PR, say the later PR fixes it. */
const FIX_WORDS = String.raw`(?:fix(?:e[sd])?|resolve[sd]?|close[sd]?|revert(?:s|ed)?|regression\s+(?:from|in|of)|broken\s+(?:by|in)|follow[-\s]?up\s+(?:fix\s+)?(?:for|to|of))`
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/gu

/** A merged PR, with the files it changed and its description. */
export interface MergedPull {
  repo: string
  number: number
  title: string
  body: string
  url: string
  author: string
  mergedAt: string
  files: string[]
}

/** A PR you approved and saw merge, with the PRs that mention it later. */
export interface ApprovedCandidate extends MergedPull {
  approvedAt: string
  mentionedBy: MergedPull[]
}

/** A pair whose diffs must be compared before it counts: a fix of files the approved PR changed. */
export interface LineCheck {
  approved: ApprovedCandidate
  fix: MergedPull
  sharedFiles: string[]
}

const escapeRegex = (text: string) => text.replaceAll(REGEX_SPECIALS, String.raw`\$&`)

const keyOf = (pull: { repo: string; number: number }) => `${pull.repo.toLowerCase()}#${pull.number}`

export const looksLikeFix = (title: string) => FIX_TITLE.test(title)

function listSharedFiles(left: readonly string[], right: readonly string[]) {
  const other = new Set(right)
  return left.filter((path) => other.has(path) && !NOISE_FILES.test(path))
}

/**
 * How a later PR says it fixes the approved one, or null when it only mentions it: a revert of it, a fix word right
 * before its number or link ("fixes #12", "regression from acme/web#12"), or a fix title carrying its number.
 */
export function findExplicitLink(approved: MergedPull, later: MergedPull): FollowUp['reason'] | null {
  const reference = String.raw`(?:${escapeRegex(approved.repo)})?#${approved.number}\b|${escapeRegex(approved.url)}\b`
  const text = `${later.title}\n${later.body}`
  const sameRepo = later.repo.toLowerCase() === approved.repo.toLowerCase()
  const namesIt = new RegExp(reference, 'iu').test(text) && (sameRepo || text.includes(approved.url))
  if (!namesIt) {
    return null
  }
  if (REVERT_TITLE.test(later.title)) {
    return 'reverts'
  }
  const fixWordBefore = new RegExp(String.raw`${FIX_WORDS}\s*:?\s*(?:${reference})`, 'iu').test(text)
  const titleCarriesIt = looksLikeFix(later.title) && new RegExp(reference, 'iu').test(later.title)
  if (fixWordBefore || titleCarriesIt) {
    return 'says-fixes'
  }
  return null
}

function mergedWithinWindow(approved: MergedPull, later: MergedPull) {
  const gap = Date.parse(later.mergedAt) - Date.parse(approved.mergedAt)
  return gap > 0 && gap <= FOLLOW_UP_DAYS * MS_PER_DAY
}

export function toFollowUp(pull: MergedPull, reason: FollowUp['reason'], approved: MergedPull, rewrittenLines = 0) {
  const { files: _files, body: _body, ...rest } = pull
  const followUp: FollowUp = {
    ...rest,
    reason,
    sharedFiles: listSharedFiles(approved.files, pull.files),
    rewrittenLines,
    lesson: null,
    lessonPending: false,
  }
  return followUp
}

/** The later PRs that say they fix the approved one, by key. */
export function findLinkedFixes(approved: ApprovedCandidate): Map<string, FollowUp> {
  const found = new Map<string, FollowUp>()
  for (const mention of approved.mentionedBy) {
    const reason = findExplicitLink(approved, mention)
    if (keyOf(mention) !== keyOf(approved) && Date.parse(mention.mergedAt) > Date.parse(approved.mergedAt) && reason) {
      found.set(keyOf(mention), toFollowUp(mention, reason, approved))
    }
  }
  return found
}

/** Fixes in the same repository, soon after, touching the approved PR's files, not already linked: to compare. */
export function listLineChecks(
  approved: ApprovedCandidate,
  fixes: readonly MergedPull[],
  linked: ReadonlyMap<string, FollowUp>,
): LineCheck[] {
  return fixes.flatMap((fix) => {
    const sharedFiles = listSharedFiles(approved.files, fix.files)
    const sameRepo = fix.repo.toLowerCase() === approved.repo.toLowerCase()
    if (!(sameRepo && sharedFiles.length > 0 && !linked.has(keyOf(fix)) && mergedWithinWindow(approved, fix))) {
      return []
    }
    return [{ approved, fix, sharedFiles }]
  })
}

/** The approved PRs with their fixes, those with none left out, most recent merge first. */
export function collectApproved(
  approved: readonly ApprovedCandidate[],
  followUps: ReadonlyMap<ApprovedCandidate, FollowUp[]>,
): ApprovedPull[] {
  return approved
    .map((candidate) => {
      const { files: _files, mentionedBy: _mentionedBy, body: _body, ...rest } = candidate
      const fixes = [...(followUps.get(candidate) ?? [])].sort((left, right) =>
        left.mergedAt.localeCompare(right.mergedAt),
      )
      return { ...rest, followUps: fixes }
    })
    .filter((pull) => pull.followUps.length > 0)
    .sort((left, right) => right.mergedAt.localeCompare(left.mergedAt))
}
