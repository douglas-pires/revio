const DISCUSSION_ANCHOR = /#discussion_r(?<id>\d+)$/u

/** The review comment id in a GitHub review comment link (`…#discussion_r123`), or null for any other link. */
export function reviewCommentIdFromUrl(url: string): number | null {
  const id = DISCUSSION_ANCHOR.exec(url)?.groups?.id
  if (id === undefined) {
    return null
  }
  return Number(id)
}
