import { useEffect, useRef, useState } from 'react'
import { REACTIONS, type ReactionContent, type ReactionSummary } from '@shared/reaction.types'
import { applyReaction } from '@shared/reaction.util'
import { cx, errorMessage } from '../common/format.util'
import { useSetReaction } from './use-reactions.hook'

const EMOJI = new Map<string, string>(REACTIONS.map((r) => [r.content, r.emoji]))

/** A comment's reactions as toggleable pills, plus a picker to add one. Shows yours right away, then GitHub's answer. */
export function ReactionBar({ subjectId, reactions }: { subjectId: string; reactions: readonly ReactionSummary[] }) {
  const setReaction = useSetReaction()
  const [shown, setShown] = useState<readonly ReactionSummary[]>(reactions)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setShown(reactions), [reactions])

  const toggle = async (content: ReactionContent, on: boolean) => {
    if (!setReaction) return
    const before = shown
    setShown(applyReaction(shown, content, on))
    setError(null)
    try {
      setShown(await setReaction(subjectId, content, on))
    } catch (e) {
      setShown(before)
      setError(errorMessage(e))
    }
  }

  if (!setReaction && !shown.length) return null
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1" data-reactions>
      {shown.map((r) => (
        <button
          key={r.content}
          disabled={!setReaction}
          title={r.viewerHasReacted ? 'Remove your reaction' : 'React'}
          aria-pressed={r.viewerHasReacted}
          onClick={() => void toggle(r.content, !r.viewerHasReacted)}
          className={cx(
            'flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] leading-none',
            r.viewerHasReacted ? 'border-accent/60 bg-accent/15 text-fg' : 'border-line text-muted hover:border-muted',
          )}
        >
          <span>{EMOJI.get(r.content)}</span>
          <span>{r.count}</span>
        </button>
      ))}
      {setReaction && <ReactionPicker reacted={new Set(shown.filter((r) => r.viewerHasReacted).map((r) => r.content))} onPick={(c, on) => void toggle(c, on)} />}
      {error && <span className="text-[11.5px] text-danger">{error}</span>}
    </div>
  )
}

function ReactionPicker({ reacted, onPick }: { reacted: ReadonlySet<ReactionContent>; onPick: (content: ReactionContent, on: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        title="Add a reaction"
        aria-label="Add a reaction"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-6 items-center rounded-full border border-transparent px-1.5 text-[13px] text-muted hover:border-line hover:text-fg"
      >
        ☺<span className="text-[10px]">+</span>
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-lg border border-line bg-panel p-1 shadow-lg">
          {REACTIONS.map((r) => (
            <button
              key={r.content}
              role="menuitemcheckbox"
              aria-checked={reacted.has(r.content)}
              title={r.label}
              aria-label={r.label}
              onClick={() => {
                onPick(r.content, !reacted.has(r.content))
                setOpen(false)
              }}
              className={cx('size-7 rounded text-[15px] hover:bg-hover', reacted.has(r.content) && 'bg-accent/15')}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
