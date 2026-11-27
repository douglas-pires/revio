import { useContext, useState } from 'react'
import { MentionScopeContext } from '../mentionables/mention-scope.context.ts'
import { GuideEntryDialog } from './guide-entry-dialog.component.tsx'

/** "Add to guide" on a comment in a PR: opens the dialog that makes the comment a line of a review guide. */
export function AddToGuideButton({
  path,
  comment,
  className,
  children = 'Add to guide',
}: {
  path: string
  comment: string
  className?: string
  children?: React.ReactNode
}) {
  const scope = useContext(MentionScopeContext)
  const [open, setOpen] = useState(false)
  if (!scope) {
    return null
  }
  return (
    <>
      <button
        type="button"
        className={className}
        title="Make this comment a line of a review guide, so Claude checks for it next time"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {Boolean(open) && (
        <GuideEntryDialog repo={scope.repo} path={path} comment={comment} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
