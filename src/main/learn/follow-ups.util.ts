import type { ApprovedPull, FollowUp } from '@shared/learn.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'

/** A fix this long after the approved PR merged is no longer counted as following it, unless it names it. */
const FOLLOW_UP_DAYS = 60
const FIX_TITLE = /\b(?:fix(?:e[ds])?|bug|hotfix|revert(?:s|ed)?|regression|broken|crash(?:es)?)\b/iu
/** Files too shared for changing both to mean anything. */
const NOISE_FILES = /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock|package\.json|CHANGELOG\.md|.+\.snap)$/u

/** A merged PR, with the files it changed. */
export interface MergedPull {
  repo: string
  number: number
  title: string
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

export const looksLikeFix = (title: string) => FIX_TITLE.test(title)

const keyOf = (pull: { repo: string; number: number }) => `${pull.repo.toLowerCase()}#${pull.number}`

function listSharedFiles(left: readonly string[], right: readonly string[]) {
  const other = new Set(right)
  return left.filter((path) => other.has(path) && !NOISE_FILES.test(path))
}

function toFollowUp(pull: MergedPull, reason: FollowUp['reason'], sharedFiles: string[]): FollowUp {
  const { files: _files, ...rest } = pull
  return { ...rest, reason, sharedFiles }
}

/** Whether `later` merged after `approved`, and within the window when that is required. */
function mergedAfter(approved: MergedPull, later: MergedPull, withinWindow: boolean) {
  const gap = Date.parse(later.mergedAt) - Date.parse(approved.mergedAt)
  return gap > 0 && (!withinWindow || gap <= FOLLOW_UP_DAYS * MS_PER_DAY)
}

/** The fixes that followed one approved PR: those naming it first, then fixes of the same files soon after. */
function findFollowUps(approved: ApprovedCandidate, fixes: readonly MergedPull[]): FollowUp[] {
  const found = new Map<string, FollowUp>()
  for (const mention of approved.mentionedBy) {
    if (keyOf(mention) !== keyOf(approved) && mergedAfter(approved, mention, false) && looksLikeFix(mention.title)) {
      found.set(keyOf(mention), toFollowUp(mention, 'mentions', listSharedFiles(approved.files, mention.files)))
    }
  }
  for (const fix of fixes) {
    const shared = listSharedFiles(approved.files, fix.files)
    const sameRepo = fix.repo.toLowerCase() === approved.repo.toLowerCase()
    if (sameRepo && shared.length > 0 && !found.has(keyOf(fix)) && mergedAfter(approved, fix, true)) {
      found.set(keyOf(fix), toFollowUp(fix, 'same-files', shared))
    }
  }
  return [...found.values()].sort((left, right) => left.mergedAt.localeCompare(right.mergedAt))
}

/**
 * The PRs you approved that later needed fixing, most recent first: a merged fix named them (a revert, "fixes #12"),
 * or fixed files they had changed within the following weeks.
 */
export function matchFollowUps(approved: readonly ApprovedCandidate[], fixes: readonly MergedPull[]): ApprovedPull[] {
  return approved
    .map((candidate) => {
      const { files: _files, mentionedBy: _mentionedBy, ...rest } = candidate
      return { ...rest, followUps: findFollowUps(candidate, fixes) }
    })
    .filter((pull) => pull.followUps.length > 0)
    .sort((left, right) => right.mergedAt.localeCompare(left.mergedAt))
}
