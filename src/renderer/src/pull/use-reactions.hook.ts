import type { ReactionContent, ReactionSummary } from '@shared/reaction.types.ts'
import { createContext, useContext } from 'react'

/** Sets your reaction on a comment (by GraphQL id) and returns its reactions after. */
export type SetReaction = (subjectId: string, content: ReactionContent, on: boolean) => Promise<ReactionSummary[]>

/** Provided by the PR view; without it, comments show their reactions read-only. */
export const ReactionsContext = createContext<SetReaction | null>(null)

export const useSetReaction = () => useContext(ReactionsContext)
