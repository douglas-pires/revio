/** Someone, or a team, you can mention in a repository. */
export interface Mentionable {
  /** What follows "@": a login, or `org/team`. */
  handle: string
  /** Their name, when they give one. */
  name: string | null
  avatarUrl: string
}
