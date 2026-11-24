import type { ReleaseChange, ReleaseNotes } from '@shared/whats-new.types.ts'

const CHANGE_LINE = /^[-*] (?<line>.+)$/u
const CONVENTIONAL = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?: (?<text>.+)$/u

const PULL_NUMBER = / \(#(?<number>\d+)\)$/u

type ChangeGroup = 'features' | 'fixes' | 'others'

/** The kinds of change people using Revio notice; every other kind is listed apart. */
const GROUPS: Record<string, ChangeGroup> = { feat: 'features', perf: 'features', fix: 'fixes' }

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The pull request a line ends with, and the line without it. */
function splitPull(line: string, repoUrl: string): { text: string; pull: ReleaseChange['pull'] } {
  const match = PULL_NUMBER.exec(line)
  if (!match) {
    return { text: line, pull: null }
  }
  const number = Number(match.groups?.number)
  return { text: line.slice(0, match.index), pull: { number, url: `${repoUrl}/pull/${number}` } }
}

/** A change and its group; a breaking change is always one people notice. */
function parseChange(line: string, repoUrl: string): { group: ChangeGroup; change: ReleaseChange } {
  const { text, pull } = splitPull(line, repoUrl)
  const groups = CONVENTIONAL.exec(text)?.groups
  if (!groups) {
    return { group: 'others', change: { text: capitalize(text), scope: null, breaking: false, pull } }
  }
  const breaking = groups.breaking !== undefined
  let group = GROUPS[groups.type ?? ''] ?? 'others'
  if (breaking && group === 'others') {
    group = 'features'
  }
  return { group, change: { text: capitalize(groups.text ?? ''), scope: groups.scope ?? null, breaking, pull } }
}

/** A release's notes: a list of pull requests (commits, in older ones), each sorted by its type, and anything else written there. */
export function parseReleaseNotes(
  release: Pick<ReleaseNotes, 'version' | 'publishedAt' | 'url'>,
  body: string,
  repoUrl: string,
): ReleaseNotes {
  const notes: ReleaseNotes = { ...release, introduction: '', features: [], fixes: [], others: [] }
  const written: string[] = []
  // The same commit on two merged branches is listed twice.
  const seenChanges = new Set<string>()
  for (const line of body.split(/\r?\n/u)) {
    const changeLine = CHANGE_LINE.exec(line)?.groups?.line
    if (changeLine === undefined) {
      written.push(line)
    } else if (!seenChanges.has(changeLine)) {
      seenChanges.add(changeLine)
      const { group, change } = parseChange(changeLine, repoUrl)
      notes[group].push(change)
    }
  }
  return { ...notes, introduction: written.join('\n').trim() }
}
