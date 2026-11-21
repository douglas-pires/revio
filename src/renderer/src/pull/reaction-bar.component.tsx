import { REACTIONS, type ReactionContent, type ReactionSummary } from '@shared/reaction.types.ts'
import { applyReaction } from '@shared/reaction.util.ts'
import { useEffect, useRef, useState } from 'react'
import { joinClassNames, readErrorMessage } from '../common/format.util.ts'
import { useSetReaction } from './use-reactions.hook.ts'

const EMOJI = new Map<string, string>(REACTIONS.map((reaction) => [reaction.content, reaction.emoji]))

function ReactionPicker({
  reacted,
  onPick,
}: {
  reacted: ReadonlySet<ReactionContent>
  onPick: (content: ReactionContent, on: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) {
      return
    }
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Add a reaction"
        aria-label="Add a reaction"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-6 items-center rounded-full border border-transparent px-1.5 text-[13px] text-muted hover:border-line hover:text-fg"
      >
        ☺<span className="text-[10px]">+</span>
      </button>
      {Boolean(open) && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-lg border border-line bg-panel p-1 shadow-lg"
        >
          {REACTIONS.map((reaction) => (
            <button
              type="button"
              key={reaction.content}
              role="menuitemcheckbox"
              aria-checked={reacted.has(reaction.content)}
              title={reaction.label}
              aria-label={reaction.label}
              onClick={() => {
                onPick(reaction.content, !reacted.has(reaction.content))
                setOpen(false)
              }}
              className={joinClassNames(
                'size-7 rounded text-[15px] hover:bg-hover',
                reacted.has(reaction.content) && 'bg-accent/15',
              )}
            >
              {reaction.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** A comment's reactions as toggleable pills, plus a picker to add one. Shows yours right away, then GitHub's answer. */
function describeReaction(yours: boolean) {
  if (yours) {
    return 'Remove your reaction'
  }
  return 'React'
}

export function ReactionBar({ subjectId, reactions }: { subjectId: string; reactions: readonly ReactionSummary[] }) {
  const setReaction = useSetReaction()
  const [shown, setShown] = useState<readonly ReactionSummary[]>(reactions)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setShown(reactions), [reactions])

  const toggle = async (content: ReactionContent, on: boolean) => {
    if (!setReaction) {
      return
    }
    const before = shown
    setShown(applyReaction(shown, content, on))
    setError(null)
    try {
      setShown(await setReaction(subjectId, content, on))
    } catch (failure) {
      setShown(before)
      setError(readErrorMessage(failure))
    }
  }

  if (!(setReaction || shown.length > 0)) {
    return null
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1" data-reactions={true}>
      {shown.map((reaction) => (
        <button
          type="button"
          key={reaction.content}
          disabled={!setReaction}
          title={describeReaction(reaction.viewerHasReacted)}
          aria-pressed={reaction.viewerHasReacted}
          onClick={() => toggle(reaction.content, !reaction.viewerHasReacted)}
          className={joinClassNames(
            'flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] leading-none',
            reaction.viewerHasReacted && 'border-accent/60 bg-accent/15 text-fg',
            !reaction.viewerHasReacted && 'border-line text-muted hover:border-muted',
          )}
        >
          <span>{EMOJI.get(reaction.content)}</span>
          <span>{reaction.count}</span>
        </button>
      ))}
      {Boolean(setReaction) && (
        <ReactionPicker
          reacted={new Set(shown.filter((reaction) => reaction.viewerHasReacted).map((reaction) => reaction.content))}
          onPick={(content, on) => toggle(content, on)}
        />
      )}
      {Boolean(error) && <span className="text-[11.5px] text-danger">{error}</span>}
    </div>
  )
}
