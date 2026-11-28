import { useCallback, useEffect, useRef, useState } from 'react'
import { showNotice } from '../common/notice.service.ts'
import {
  type BlockMinutes,
  isBlockOver,
  pauseBlock,
  type ReviewBlock,
  readLeftMs,
  readStoredBlock,
  resumeBlock,
  startBlock,
} from './review-block.util.ts'
import { rememberFinishedBlock } from './review-block-history.util.ts'

const STORAGE_KEY = 'revio.reviewBlock'
const TICK_MS = 1000

function loadBlock() {
  try {
    return readStoredBlock(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

/** Keeps the block across reloads (a convenience: storage failures are ignored). */
function storeBlock(block: ReviewBlock | null) {
  try {
    if (block === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(block))
    }
  } catch {
    /* private mode or blocked storage: the block lasts until the window closes */
  }
}

/** "1 review" or "3 reviews". */
export function describeReviews(count: number) {
  if (count === 1) {
    return '1 review sent'
  }
  return `${count} reviews sent`
}

/** Says the block is over, in the window and (when Revio is behind other windows) as a notification. */
function announceEnd(block: ReviewBlock) {
  rememberFinishedBlock(block, Date.now())
  const text = `Review block done: ${block.minutes} min, ${describeReviews(block.reviews)}`
  showNotice(text)
  try {
    const notification = new Notification('Revio', { body: text })
    notification.onclick = () => globalThis.focus()
  } catch {
    /* notifications blocked: the notice and the bar say it */
  }
}

/** The clock: now, moving on each second while a block runs. */
function useClock(running: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) {
      return
    }
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [running])
  return now
}

/** Tells you once when the block runs out (not again on reload, when it was over already). */
function useEndAnnouncement(block: ReviewBlock | null, over: boolean) {
  const announced = useRef(over)
  useEffect(() => {
    if (block && over && !announced.current) {
      announced.current = true
      announceEnd(block)
    }
    if (!over) {
      announced.current = false
    }
  }, [block, over])
}

/** The review block you set aside time for: start, pause, resume and end it, and count the reviews sent in it. */
export function useReviewBlock() {
  const [block, setBlock] = useState(loadBlock)
  const running = block !== null && block.endsAt !== null
  const now = useClock(running)
  const over = block !== null && isBlockOver(block, now)
  useEndAnnouncement(block, over)

  const update = useCallback((change: (current: ReviewBlock | null) => ReviewBlock | null) => {
    setBlock((current) => {
      const next = change(current)
      storeBlock(next)
      return next
    })
  }, [])
  return {
    block,
    leftMs: block === null ? 0 : readLeftMs(block, now),
    over,
    /** Whether to hide what distracts from reviewing: while a block runs or is paused, not once it is over. */
    focused: block !== null && !over,
    start: useCallback((minutes: BlockMinutes) => update(() => startBlock(minutes, Date.now())), [update]),
    togglePause: useCallback(
      () =>
        update((current) => {
          if (current === null || current.endsAt === null) {
            return current && resumeBlock(current, Date.now())
          }
          return pauseBlock(current, Date.now())
        }),
      [update],
    ),
    end: useCallback(() => update(() => null), [update]),
    countReview: useCallback(
      () => update((current) => current && { ...current, reviews: current.reviews + 1 }),
      [update],
    ),
  }
}

export type ReviewBlockState = ReturnType<typeof useReviewBlock>
