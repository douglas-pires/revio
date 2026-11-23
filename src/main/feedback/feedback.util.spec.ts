import type { SystemInfo } from '@shared/feedback.types.ts'
import { describe, expect, it } from 'vitest'
import { buildIssue, buildNewIssueUrl, formatSystemInfo } from './feedback.util.ts'

const info: SystemInfo = {
  appVersion: '0.2.2',
  build: 'release',
  os: 'macOS 15.2',
  arch: 'arm64',
  chip: 'Apple M3 Pro',
  memoryGb: 36,
  electron: '45.0.0',
  chrome: '140.0.0.0',
  node: '24.1.0',
  locale: 'en-CA',
}
const repo = { owner: 'acme', repo: 'widgets' }

describe('formatSystemInfo', () => {
  it('lists the version, OS, chip and runtime as a table', () => {
    const table = formatSystemInfo(info)
    expect(table).toContain('| Revio | 0.2.2 (release) |')
    expect(table).toContain('| macOS | macOS 15.2 (arm64) |')
    expect(table).toContain('| Chip | Apple M3 Pro, 36 GB |')
    expect(table).toContain('| Electron | 45.0.0 (Chrome 140.0.0.0, Node 24.1.0) |')
  })
})

describe('buildIssue', () => {
  it('adds the system info to a bug report and labels it a bug', () => {
    const issue = buildIssue({ kind: 'bug', title: ' Crash ', description: 'It broke.', includeSystemInfo: true }, info)
    expect(issue.title).toBe('Crash')
    expect(issue.labels).toEqual(['bug'])
    expect(issue.body.startsWith('### What happened\n\nIt broke.\n\n### System\n\n| | |')).toBe(true)
  })

  it('leaves the system info out when unticked, and always for feature requests', () => {
    expect(
      buildIssue({ kind: 'bug', title: 't', description: 'd', includeSystemInfo: false }, info).body,
    ).not.toContain('### System')
    const feature = buildIssue({ kind: 'feature', title: 't', description: 'Dark mode', includeSystemInfo: true }, info)
    expect(feature.body).not.toContain('### System')
    expect(feature.body).toContain('### The idea\n\nDark mode')
    expect(feature.labels).toEqual(['enhancement'])
  })
})

describe('buildNewIssueUrl', () => {
  it('fills in the title, body and label', () => {
    const url = new URL(buildNewIssueUrl(repo, { title: 'A & B', body: 'line\nnext', labels: ['bug'] }))
    expect(url.origin + url.pathname).toBe('https://github.com/acme/widgets/issues/new')
    expect(url.searchParams.get('title')).toBe('A & B')
    expect(url.searchParams.get('body')).toBe('line\nnext')
    expect(url.searchParams.get('labels')).toBe('bug')
  })

  it('cuts a body too long for a link, and says so', () => {
    const url = buildNewIssueUrl(repo, { title: 't', body: 'x'.repeat(20_000), labels: ['bug'] })
    expect(url.length).toBeLessThanOrEqual(7000)
    expect(new URL(url).searchParams.get('body')).toContain('cut to fit the link')
  })
})
