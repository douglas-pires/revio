/** What you are typing at the caret that suggestions are for, such as `:smi` or `@an`. */
export interface TypedTrigger {
  /** The character that started it. */
  character: string
  /** What follows the character, so far. */
  query: string
  /** Where the character is in the text. */
  start: number
}

/** After the text's start, a space or an opening mark: a name or emoji begins a word, so "10:30" and emails don't count. */
const WORD = /(?:^|[\s([{"'*_>])(?<word>[:@][\w+./-]*)$/u

/** The trigger being typed at the caret, one of `characters`; null when there is none. */
export function findTrigger(text: string, caret: number, characters: readonly string[]): TypedTrigger | null {
  const word = WORD.exec(text.slice(0, caret))?.groups?.word
  const character = word?.charAt(0)
  if (!(word && character && characters.includes(character))) {
    return null
  }
  return { character, query: word.slice(1), start: caret - word.length }
}
