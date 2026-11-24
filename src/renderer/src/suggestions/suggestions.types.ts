import type { ReactNode } from 'react'

/** Something a text box offers to write for you. */
export interface Suggestion {
  key: string
  /** What replaces what you typed. */
  text: string
  label: string
  /** Before the label. */
  picture?: ReactNode
  /** After the label, muted. */
  detail?: string | undefined
}

/** Where a kind of suggestion comes from. */
export interface Suggester {
  /** The character that starts it, like ":". */
  character: string
  /** The best suggestions for what follows the character, so far. */
  suggest: (query: string) => readonly Suggestion[]
  /** Called when its character is typed, to load what it needs. */
  prepare?: () => void
}
