import type { FeedbackInput, FeedbackKind, SystemInfo } from '@shared/feedback.types.ts'

/** GitHub's default labels for each kind. */
const LABELS: Record<FeedbackKind, string> = { bug: 'bug', feature: 'enhancement' }

/** The heading over the description. */
const DESCRIPTION_HEADINGS: Record<FeedbackKind, string> = { bug: 'What happened', feature: 'The idea' }

/** Browsers and GitHub cope with new-issue links up to about this long; longer bodies are cut. */
const MAX_URL_LENGTH = 7000

/** Each pass keeps this share of a body that is still too long. */
const KEEP_SHARE_PER_CUT = 0.9

const TRUNCATION_NOTE = '\n\n…(cut to fit the link; add the rest on GitHub)'

export interface IssueDraft {
  title: string
  body: string
  labels: string[]
}

/** The system info as a two-column markdown table. */
export function formatSystemInfo(info: SystemInfo): string {
  const rows: [string, string][] = [
    ['Revio', `${info.appVersion} (${info.build})`],
    ['macOS', `${info.os} (${info.arch})`],
    ['Chip', `${info.chip}, ${info.memoryGb} GB`],
    ['Electron', `${info.electron} (Chrome ${info.chrome}, Node ${info.node})`],
    ['Locale', info.locale],
  ]
  return ['| | |', '|---|---|', ...rows.map(([name, value]) => `| ${name} | ${value} |`)].join('\n')
}

/** The issue for a piece of feedback: its title, a body with the description (and system info for bugs), a label. */
export function buildIssue(input: FeedbackInput, info: SystemInfo | null): IssueDraft {
  const sections = [`### ${DESCRIPTION_HEADINGS[input.kind]}\n\n${input.description.trim()}`]
  if (input.kind === 'bug' && input.includeSystemInfo && info) {
    sections.push(`### System\n\n${formatSystemInfo(info)}`)
  }
  sections.push("<sub>Sent from Revio's Settings → Feedback.</sub>")
  return { title: input.title.trim(), body: sections.join('\n\n'), labels: [LABELS[input.kind]] }
}

/** A link to GitHub's new-issue form, filled in with the issue; a body too long for a link is cut. */
export function buildNewIssueUrl(repo: { owner: string; repo: string }, issue: IssueDraft): string {
  const base = `https://github.com/${repo.owner}/${repo.repo}/issues/new`
  const linkTo = (text: string) => {
    const query = new URLSearchParams({ title: issue.title, body: text, labels: issue.labels.join(',') })
    return `${base}?${query.toString()}`
  }
  let { body } = issue
  let url = linkTo(body)
  while (url.length > MAX_URL_LENGTH && body.length > 0) {
    body = body.slice(0, Math.floor(body.length * KEEP_SHARE_PER_CUT))
    url = linkTo(body + TRUNCATION_NOTE)
  }
  return url
}
