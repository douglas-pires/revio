import type { PullCommit } from '@shared/history.types.ts'
import { ShortcutHint } from '../shortcuts/shortcut-hint.component.tsx'

const ALL = 'all'
/** Characters of a commit's headline shown in the menu. */
const HEADLINE_CHARS = 60

/** What the stepper needs: the commits, which one is shown (null for all), and moving between them. */
export interface CommitStepperProps {
  commits: readonly PullCommit[]
  index: number | null
  onStep: (by: 1 | -1) => void
  onPick: (index: number | null) => void
}

/** A commit as its menu line: "2. Fix the total". */
function describeOption(commit: PullCommit, index: number) {
  const line = `${index + 1}. ${commit.headline.slice(0, HEADLINE_CHARS)}`
  if (commit.isMerge) {
    return `${line} (merge)`
  }
  return line
}

/** The menu's value as a commit's position, or null for all of them. */
function readPicked(value: string) {
  if (value === ALL) {
    return null
  }
  return Number(value)
}

/** "‹ All commits ›": steps through the PR's commits one at a time, or picks one from the menu. */
export function CommitStepper({ commits, index, onStep, onPick }: CommitStepperProps) {
  return (
    <span className="mr-3 flex shrink-0 items-center gap-0.5 @max-3xl:mr-1.5">
      <ShortcutHint action="previous-commit">
        <button
          type="button"
          className="btn btn-ghost px-1.5 py-0"
          aria-label="Previous commit"
          onClick={() => onStep(-1)}
        >
          ‹
        </button>
      </ShortcutHint>
      <select
        className="input w-auto max-w-40 py-0.5 text-[12px] @max-5xl:max-w-24"
        aria-label="Commit shown"
        value={index ?? ALL}
        onChange={(event) => onPick(readPicked(event.target.value))}
      >
        <option value={ALL}>All commits</option>
        {commits.map((commit, position) => (
          <option key={commit.sha} value={position}>
            {describeOption(commit, position)}
          </option>
        ))}
      </select>
      <ShortcutHint action="next-commit">
        <button type="button" className="btn btn-ghost px-1.5 py-0" aria-label="Next commit" onClick={() => onStep(1)}>
          ›
        </button>
      </ShortcutHint>
    </span>
  )
}
