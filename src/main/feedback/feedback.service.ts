import { cpus, totalmem } from 'node:os'
import type { Octokit } from '@octokit/rest'
import type { FeedbackInput, FeedbackResult, SystemInfo } from '@shared/feedback.types.ts'
import { app, shell } from 'electron'
import type { ReleaseSource } from '../updates/release.util.ts'
import { buildIssue, buildNewIssueUrl } from './feedback.util.ts'

/** 1024³. */
const BYTES_PER_GB = 1_073_741_824

/** Basic facts about this Mac and this Revio. Nothing that names you, your files or your repositories. */
export function readSystemInfo(): SystemInfo {
  let build: SystemInfo['build'] = 'development'
  if (app.isPackaged) {
    build = 'release'
  }
  return {
    appVersion: app.getVersion(),
    build,
    os: `macOS ${process.getSystemVersion()}`,
    arch: process.arch,
    chip: cpus()[0]?.model.trim() ?? 'unknown',
    memoryGb: Math.round(totalmem() / BYTES_PER_GB),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    locale: app.getLocale(),
  }
}

/**
 * Opens an issue for the feedback in Revio's repository, as you, with your GitHub token. When that fails (no token,
 * or one that cannot open issues there), it opens GitHub's new-issue form in the browser, filled in, to submit there.
 */
export async function submitFeedback(
  octokit: () => Promise<Octokit>,
  repo: ReleaseSource,
  input: FeedbackInput,
): Promise<FeedbackResult> {
  if (!(input.title.trim() && input.description.trim())) {
    throw new Error('Add a title and a description first.')
  }
  const issue = buildIssue(input, readSystemInfo())
  try {
    const { data } = await (await octokit()).issues.create({ owner: repo.owner, repo: repo.repo, ...issue })
    return { url: data.html_url, via: 'created' }
  } catch {
    const url = buildNewIssueUrl(repo, issue)
    await shell.openExternal(url)
    return { url, via: 'browser' }
  }
}
