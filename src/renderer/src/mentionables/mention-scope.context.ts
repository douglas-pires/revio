import { createContext } from 'react'

/** Where you are writing: the repository, and who takes part in the PR. */
export interface MentionScope {
  repo: string
  participants: ReadonlySet<string>
}

/** Null outside a PR, where nobody is suggested. */
export const MentionScopeContext = createContext<MentionScope | null>(null)
