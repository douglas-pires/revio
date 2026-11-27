/** A comment you left on code in a review you sent. */
interface PastComment {
  body: string
  path: string
  url: string
  createdAt: string
}
/** A review you sent on someone's PR, with the comments in it. */
export interface PastReview {
  repo: string
  number: number
  title: string
  url: string
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  submittedAt: string
  comments: PastComment[]
}
/** A comment you sent before that reads like the one being written, and the PR it was on. */
export interface SimilarComment extends PastComment {
  repo: string
  number: number
}
/** A line to add to a review guide: the guide's repository ("*" for all) and folder ('' for the whole repo). */
export interface GuideEntry {
  repo: string
  path: string
  text: string
}
