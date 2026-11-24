/** One of GitHub's emojis. */
export interface Emoji {
  /** Its GitHub name, written `:name:`. */
  name: string
  /** What to write for it: the character, or `:name:` for one only GitHub draws (octocat) or made of several. */
  text: string
  /** GitHub's picture of it. */
  imageUrl: string
}
