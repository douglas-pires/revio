import type { MissLesson } from '@shared/learn.types.ts'
import type { PullRef } from '@shared/pull.types.ts'
import { useState } from 'react'
import { joinClassNames, readErrorMessage } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { GuideEntryDialog } from '../guidelines/guide-entry-dialog.component.tsx'

const VERDICTS: Record<MissLesson['couldReviewCatch'], { label: string; tone: string }> = {
  yes: { label: 'A review could have caught it', tone: 'bg-warn/15 text-warn' },
  maybe: { label: 'A review might have caught it', tone: 'bg-accent/15 text-accent' },
  no: { label: 'Not visible in the diff', tone: 'bg-ok/15 text-ok' },
}

/** Claude's reading of the miss: what went wrong, whether the diff showed it, and the lesson, which can go in a guide. */
function LessonView({ lesson, repo }: { lesson: MissLesson; repo: string }) {
  const [adding, setAdding] = useState(false)
  const verdict = VERDICTS[lesson.couldReviewCatch]
  return (
    <div className="mt-2 space-y-2 rounded-md border border-line bg-panel-2 p-3 text-[12.5px]">
      <span className={joinClassNames('chip', verdict.tone)}>{verdict.label}</span>
      <Markdown className="text-[12.5px]">{lesson.whatWentWrong}</Markdown>
      <div className="text-muted">
        {lesson.path !== null && <span className="mr-1.5 font-mono text-[11.5px] text-fg">{lesson.path}</span>}
        <Markdown className="inline text-[12.5px]">{lesson.clue}</Markdown>
      </div>
      <div className="flex items-start gap-2 rounded-md bg-accent/10 px-2.5 py-2">
        <span aria-hidden={true}>💡</span>
        <span className="flex-1 font-medium">{lesson.lesson}</span>
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
    </div>
  )
}

/** "What could the review have caught?" for one fix, and Claude's answer once asked. */
export function MissLessonButton({ original, fix }: { original: PullRef; fix: PullRef }) {
  const [lesson, setLesson] = useState<MissLesson | null>(null)
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
