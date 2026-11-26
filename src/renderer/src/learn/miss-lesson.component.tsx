import type { MissLesson } from '@shared/learn.types.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { useEffect, useRef, useState } from 'react'
import { joinClassNames, readErrorMessage } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { GuideEntryDialog } from '../guidelines/guide-entry-dialog.component.tsx'

const VERDICTS: Record<MissLesson['couldReviewCatch'], { label: string; tone: string }> = {
  yes: { label: 'A review could have caught it', tone: 'bg-warn/15 text-warn' },
  maybe: { label: 'A review might have caught it', tone: 'bg-accent/15 text-accent' },
  no: { label: 'Not visible in the diff', tone: 'bg-ok/15 text-ok' },
  unrelated: { label: 'Not a fix of this PR', tone: 'bg-panel text-muted' },
}

/** The lesson itself: where the sign was, and what to keep, which can go in a guide. */
function LessonParts({ lesson, repo }: { lesson: MissLesson; repo: string }) {
  const [adding, setAdding] = useState(false)
  return (
    <>
      <div>
        <div className="mb-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Where it showed</div>
        {lesson.path !== null && <div className="font-mono text-[11.5px]">{lesson.path}</div>}
        <Markdown className="text-[12.5px] text-muted">{lesson.clue}</Markdown>
      </div>
      <div className="flex items-start gap-2 rounded-md bg-accent/10 px-2.5 py-2">
        <span aria-hidden={true}>💡</span>
        <Markdown className="flex-1 text-[12.5px] font-medium">{lesson.lesson}</Markdown>
        <button type="button" className="btn btn-ghost shrink-0 py-0 text-accent" onClick={() => setAdding(true)}>
          Add to a guide
        </button>
      </div>
      {Boolean(adding) && (
        <GuideEntryDialog
          repo={repo}
          path={lesson.path ?? ''}
          comment={lesson.lesson}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  )
}

/**
 * Claude's reading of the miss: what went wrong, whether the diff showed it, and the lesson. When the later PR turns
 * out not to fix the approved one, only why, dimmed, with no lesson to keep.
 */
function LessonView({ lesson, repo }: { lesson: MissLesson; repo: string }) {
  const verdict = VERDICTS[lesson.couldReviewCatch]
  const unrelated = lesson.couldReviewCatch === 'unrelated'
  return (
    <div
      className={joinClassNames(
        'mt-2 space-y-2 rounded-md border border-line bg-panel-2 p-3 text-[12.5px]',
        unrelated && 'opacity-70',
      )}
    >
      <span className={joinClassNames('chip', verdict.tone)}>{verdict.label}</span>
      <Markdown className="text-[12.5px]">{lesson.whatWentWrong}</Markdown>
      {!unrelated && <LessonParts lesson={lesson} repo={repo} />}
    </div>
  )
}

/** "What could the review have caught?" for one fix, and Claude's answer once asked (kept for later visits). */
export function MissLessonButton({
  original,
  fix,
  saved,
  pending,
}: {
  original: PullRef
  fix: PullRef
  /** The lesson learned before, kept from an earlier visit. */
  saved: MissLesson | null
  /** Claude is still writing it, asked for before you left: wait for that answer. */
  pending: boolean
}) {
  const [lesson, setLesson] = useState<MissLesson | null>(saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ask = async () => {
    setBusy(true)
    setError(null)
    try {
      setLesson(await globalThis.revio.explainMiss(original, fix))
    } catch (failure) {
      setError(readErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  // Joins the request still running in the background; it does not ask Claude again.
  const joined = useRef(false)
  useEffect(() => {
    if (pending && !joined.current) {
      joined.current = true
      ask()
    }
  })
  if (lesson) {
    return <LessonView lesson={lesson} repo={original.repo} />
  }
  return (
    <div className="mt-1.5">
      <button type="button" className="btn py-0.5 text-[12px] text-accent" disabled={busy} onClick={ask}>
        {Boolean(busy) && 'Claude is comparing the two PRs…'}
        {!busy && '✦ What could the review have caught?'}
      </button>
      {error !== null && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
