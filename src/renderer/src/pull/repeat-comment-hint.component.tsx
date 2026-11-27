import type { SimilarComment } from '@shared/review-history.types.ts'
import { useContext } from 'react'
import { AddToGuideButton } from '../guidelines/add-to-guide-button.component.tsx'
import { MentionScopeContext } from '../mentionables/mention-scope.context.ts'
import { useSimilarComments } from './use-similar-comments.hook.ts'

/** Where an earlier comment was: "#12" in the same repository, "acme/api#12" in another. */
function describePlace(comment: SimilarComment, repo: string) {
  if (comment.repo === repo) {
    return `#${comment.number}`
  }
  return `${comment.repo}#${comment.number}`
}

/** A link to an earlier comment on GitHub. */
function EarlierComment({ comment, repo }: { comment: SimilarComment; repo: string }) {
  return (
    <a
      className="text-accent hover:underline"
      href={comment.url}
      title={comment.body}
      onClick={(event) => {
        event.preventDefault()
        globalThis.revio.openExternal(comment.url)
      }}
    >
      {describePlace(comment, repo)}
    </a>
  )
}

/**
 * Under a comment being written: when you sent comments like it before, links to them and offers to make the point
 * a line of a review guide, so Claude raises it in the next briefing instead of you writing it again.
 */
export function RepeatCommentHint({ body, path }: { body: string; path: string | undefined }) {
  const scope = useContext(MentionScopeContext)
  const earlier = useSimilarComments(body, scope !== null && path !== undefined)
  if (!(scope && path) || earlier.length === 0) {
    return null
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-accent/5 px-2 py-1 text-[11.5px] text-muted">
      <span aria-hidden={true}>↺</span>
      <span>You wrote something like this before:</span>
      {earlier.map((comment) => (
        <EarlierComment key={comment.url} comment={comment} repo={scope.repo} />
      ))}
      <AddToGuideButton path={path} comment={body} className="btn btn-ghost ml-auto py-0 text-accent">
        Make it a guide entry
      </AddToGuideButton>
    </div>
  )
}
