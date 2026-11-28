import type { ReviewBlock } from './review-block.util.ts'

const STORAGE_KEY = 'revio.reviewBlockHistory'
/** Enough blocks for half a year of several a day. */
const MAX_KEPT = 500

/** A review block that ran to its end. */
export interface FinishedBlock {
  endedAt: string
  minutes: number
  reviews: number
}

/** The blocks that ran to their end on this Mac, oldest first (a convenience: storage failures read as none). */
export function readFinishedBlocks(): FinishedBlock[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(stored) ? (stored as FinishedBlock[]) : []
  } catch {
    return []
  }
}

/** Keeps a block that ran to its end, for the stats. */
export function rememberFinishedBlock(block: ReviewBlock, endedAt: number) {
  const finished = { endedAt: new Date(endedAt).toISOString(), minutes: block.minutes, reviews: block.reviews }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...readFinishedBlocks(), finished].slice(-MAX_KEPT)))
  } catch {
    /* private mode or blocked storage: this block is not kept */
  }
}
