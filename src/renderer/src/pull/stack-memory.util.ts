import type { Stack } from '@shared/inbox.types.ts'
import { isSamePull, type PullRef } from '@shared/pull.types.ts'
import type { PullTab } from './pull-tabs.util.ts'

/**
 * What the PR view remembers about the stack you are moving through, so switching to another PR in it keeps the
 * screen as it was: the stack bar (and where it is scrolled) shows at once, and the same tab stays open.
 * Kept outside React because each PR's view is a new component.
 */
interface StackMemory {
  stack: Stack
  /** How far the stack bar is scrolled sideways. */
  scrollLeft: number
  /** The tab last open on any PR of this stack. */
  tab: PullTab | null
}

let memory: StackMemory | null = null

const holds = (stack: Stack, pull: PullRef) => stack.nodes.some((node) => isSamePull(node.pr, pull))

/** The remembered memory when `pull` belongs to its stack. */
function memoryFor(pull: PullRef): StackMemory | null {
  if (memory !== null && holds(memory.stack, pull)) {
    return memory
  }
  return null
}

/** The last stack you were in, when it holds `pull`: shown at once while the PR's own lookup runs. */
export function knownStackOf(pull: PullRef): Stack | null {
  return memoryFor(pull)?.stack ?? null
}

/** The PR at `pull` in its remembered stack (title, author, branches), for showing it before its details load. */
export function knownStackPr(pull: PullRef) {
  return memoryFor(pull)?.stack.nodes.find((node) => isSamePull(node.pr, pull))?.pr ?? null
}

/** Remembers a stack the view found; the scroll and tab carry over when it is the same stack as before. */
export function rememberStack(stack: Stack) {
  if (memory?.stack.id === stack.id) {
    memory = { ...memory, stack }
    return
  }
  memory = { stack, scrollLeft: 0, tab: null }
}

export function stackScrollOf(stack: Stack): number {
  if (memory?.stack.id === stack.id) {
    return memory.scrollLeft
  }
  return 0
}

export function rememberStackScroll(stack: Stack, scrollLeft: number) {
  if (memory?.stack.id === stack.id) {
    memory = { ...memory, scrollLeft }
  }
}

/** The tab to open on `pull`: the one you had open on the stack's last PR, when `pull` is in that stack. */
export function stackTabFor(pull: PullRef): PullTab | null {
  return memoryFor(pull)?.tab ?? null
}

export function rememberStackTab(pull: PullRef, tab: PullTab) {
  if (memory !== null && holds(memory.stack, pull)) {
    memory = { ...memory, tab }
  }
}

/** Forgets everything; for tests. */
export function forgetStackMemory() {
  memory = null
}
