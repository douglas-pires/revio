/** How long a review block can be, in minutes. */
export const BLOCK_MINUTES = [25, 45, 60, 90] as const

export type BlockMinutes = (typeof BLOCK_MINUTES)[number]

const MS_PER_MINUTE = 60_000
const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

/**
 * Time set aside for reviewing: how long, when it ends while running (null while paused), how much was left when it
 * was paused, and how many reviews you sent during it.
 */
export interface ReviewBlock {
  minutes: BlockMinutes
  endsAt: number | null
  pausedLeftMs: number
  reviews: number
}

export function startBlock(minutes: BlockMinutes, now: number): ReviewBlock {
  return { minutes, endsAt: now + minutes * MS_PER_MINUTE, pausedLeftMs: 0, reviews: 0 }
}

/** What is left of the block, in ms; 0 once it is over. */
export function readLeftMs(block: ReviewBlock, now: number) {
  if (block.endsAt === null) {
    return block.pausedLeftMs
  }
  return Math.max(0, block.endsAt - now)
}

export function isBlockOver(block: ReviewBlock, now: number) {
  return readLeftMs(block, now) === 0
}

export function pauseBlock(block: ReviewBlock, now: number): ReviewBlock {
  if (block.endsAt === null) {
    return block
  }
  return { ...block, endsAt: null, pausedLeftMs: readLeftMs(block, now) }
}

export function resumeBlock(block: ReviewBlock, now: number): ReviewBlock {
  if (block.endsAt !== null) {
    return block
  }
  return { ...block, endsAt: now + block.pausedLeftMs, pausedLeftMs: 0 }
}

/** Time left as a clock: "44:59", or "1:29:59" past an hour. */
export function formatClock(ms: number) {
  const totalSeconds = Math.ceil(ms / MS_PER_SECOND)
  const hours = Math.floor(totalSeconds / (SECONDS_PER_MINUTE * SECONDS_PER_MINUTE))
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE) % SECONDS_PER_MINUTE
  const seconds = String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
  }
  return `${minutes}:${seconds}`
}

/** A block read back from storage, or null when there is none or it does not look like one. */
export function readStoredBlock(text: string | null): ReviewBlock | null {
  if (text === null) {
    return null
  }
  try {
    const block = JSON.parse(text) as Partial<ReviewBlock>
    const validMinutes = BLOCK_MINUTES.some((minutes) => minutes === block.minutes)
    if (!validMinutes || typeof block.pausedLeftMs !== 'number' || typeof block.reviews !== 'number') {
      return null
    }
    return block as ReviewBlock
  } catch {
    return null
  }
}
