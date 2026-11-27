import type { DiffSide } from '@shared/pull.types.ts'
import { createContext } from 'react'

/**
 * Which lines can take a new comment, or null for any line of the diff. Showing only the changes since your review,
 * a comment can go only on lines that are part of the PR's own diff on the new side; GitHub places it there.
 */
export type CanComment = (path: string, side: DiffSide, line: number) => boolean

export const CommentableLinesContext = createContext<CanComment | null>(null)
