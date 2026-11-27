/** Lines shown from a permalink at most; a longer range is cut, with a link to the rest on GitHub. */
export const MAX_PERMALINK_LINES = 60

/** github.com/<owner>/<repo>/blob/<ref>/<path>#L<start>[-L<end>] */
const PERMALINK =
  /^https:\/\/github\.com\/(?<repo>[\w.-]+\/[\w.-]+)\/blob\/(?<ref>[^/]+)\/(?<path>[^#?]+)(?:\?[^#]*)?#L(?<start>\d+)(?:-L(?<end>\d+))?$/u

/** Lines of a file at a commit (or branch), as a GitHub permalink names them. */
export interface Permalink {
  repo: string
  ref: string
  path: string
  start: number
  end: number
}

/** The file and lines a GitHub permalink points to, or null for any other link. */
export function parsePermalink(url: string): Permalink | null {
  const groups = PERMALINK.exec(url)?.groups
  if (!(groups?.repo && groups.ref && groups.path && groups.start)) {
    return null
  }
  const start = Number(groups.start)
  const end = Number(groups.end ?? groups.start)
  return {
    repo: groups.repo,
    ref: groups.ref,
    path: decodeURIComponent(groups.path),
    start: Math.min(start, end),
    end: Math.max(start, end),
  }
}

/** The permalink's lines out of the whole file, cut to MAX_PERMALINK_LINES; null when the file is shorter. */
export function sliceLines(text: string, link: Pick<Permalink, 'start' | 'end'>) {
  const lines = text.split('\n')
  if (link.start > lines.length) {
    return null
  }
  const last = Math.min(link.end, lines.length, link.start + MAX_PERMALINK_LINES - 1)
  return { code: lines.slice(link.start - 1, last).join('\n'), cut: last < link.end }
}

/** The "#L10" or "#L10-L20" anchor of a line range. */
function describeAnchor(start: number, end: number) {
  if (start === end) {
    return `#L${start}`
  }
  return `#L${start}-L${end}`
}

/** A permalink to lines of a file at a commit; `pullUrl` gives the repository's address on GitHub. */
export function buildPermalink(
  pullUrl: string,
  sha: string,
  path: string,
  lines: { start: number; end: number } | null,
) {
  const repoUrl = pullUrl.slice(0, pullUrl.lastIndexOf('/pull/'))
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const anchor = lines ? describeAnchor(lines.start, lines.end) : ''
  return `${repoUrl}/blob/${sha}/${encodedPath}${anchor}`
}
