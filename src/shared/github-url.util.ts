/** The review comment id in a GitHub review comment link (`…#discussion_r123`), or null for any other link. */
export function reviewCommentIdFromUrl(url: string): number | null {
  const m = /#discussion_r(\d+)$/.exec(url)
  return m ? Number(m[1]) : null
}
