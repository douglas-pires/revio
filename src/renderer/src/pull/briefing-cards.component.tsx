import type { Briefing, Concern, DismissedConcern, FocusItem } from '@shared/claude.types.ts'
import { keepUndismissed } from '@shared/concern-filter.util.ts'
import { useState } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { CodeSnippet } from './code-snippet.component.tsx'
import { hasSummaryLine } from './pull-view.util.ts'

type GuidelineCheck = Briefing['guidelineChecks'][number]

type CardTone = 'focus' | 'danger' | 'plain'

const CARD_TONES: Record<CardTone, string> = { focus: 'text-focus', danger: 'text-danger', plain: 'text-muted' }

const PRIORITY_DOTS: Record<FocusItem['priority'], string> = {
  high: 'bg-danger',
  medium: 'bg-warn',
  low: 'bg-muted',
}

const CONFIDENCE_LOOK: Record<NonNullable<Concern['confidence']>, { label: string; className: string }> = {
  high: { label: 'sure', className: 'bg-danger/15 text-danger' },
  medium: { label: 'likely', className: 'bg-warn/15 text-warn' },
  low: { label: 'a hunch', className: 'bg-panel-2 text-muted' },
}

const CHECK_LOOK: Record<GuidelineCheck['status'], { className: string; mark: string }> = {
  ok: { className: 'text-ok', mark: '✓' },
  concern: { className: 'text-danger', mark: '!' },
  unclear: { className: 'text-warn', mark: '?' },
}

/** The diff of the file a concern names; none when it names no file. */
function findConcernPatch(concern: Concern, patchOf: (path: string) => string | undefined) {
  if (!concern.path) {
    return
  }
  return patchOf(concern.path)
}

/** The first line of a focus range like "42-80", or null for the whole file. */
function readFirstLine(lines: string) {
  return Number(lines.split('-')[0]) || null
}

/** How sure Claude is, as a chip; nothing on briefings written before it was asked. */
function ConfidenceChip({ confidence }: { confidence: Concern['confidence'] }) {
  if (!confidence) {
    return null
  }
  const look = CONFIDENCE_LOOK[confidence]
  return (
    <span className={joinClassNames('chip shrink-0', look.className)} title="How sure Claude is">
      {look.label}
    </span>
  )
}

/** The code that shows the problem, quoted from the diff, when there is no snippet of the line to show instead. */
function Evidence({ evidence }: { evidence: string | undefined }) {
  if (!evidence?.trim()) {
    return null
  }
  return (
    <pre className="mt-1 overflow-x-auto rounded border border-line bg-bg px-2 py-1 font-mono text-[11.5px] whitespace-pre-wrap">
      {evidence.trim()}
    </pre>
  )
}

/** One possible issue: how sure, what and why, the code, where, drafting a comment, and saying it is not one. */
function ConcernItem({
  concern,
  patch,
  canDraft,
  actions,
}: {
  concern: Concern
  patch: string | undefined
  canDraft: boolean
  actions: ConcernActions
}) {
  const { line } = concern
  // The diff shows the line when it is part of it; otherwise the quoted evidence stands in.
  const showsLine = patch !== undefined && line !== null && actions.validLine(concern.path, line)
  return (
    <li className={joinClassNames(concern.confidence === 'low' && 'opacity-75')}>
      <div className="flex items-baseline gap-2">
        <ConfidenceChip confidence={concern.confidence} />
        <span className="font-medium">{concern.title}</span>
      </div>
      <Markdown className="text-muted">{concern.detail}</Markdown>
      {showsLine && patch !== undefined && line !== null && (
        <CodeSnippet path={concern.path} patch={patch} line={line} onOpen={() => actions.onJump(concern.path, line)} />
      )}
      {!showsLine && <Evidence evidence={concern.evidence} />}
      <div className="mt-1 flex gap-2">
        {Boolean(concern.path) && (
          <button
            type="button"
            className="btn btn-ghost py-0 font-mono text-[11.5px]"
            onClick={() => actions.onJump(concern.path, line)}
          >
            {concern.path}
            {line !== null && `:${line}`}
          </button>
        )}
        {canDraft === true && line !== null && (
          <button
            type="button"
            className="btn py-0"
            onClick={() => actions.onDraft(concern.path, line, `${concern.title}\n\n${concern.detail}`)}
          >
            + Draft comment
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          className="btn btn-ghost py-0 text-muted"
          title="Hide it, and keep it out of the next briefing of this PR"
          onClick={() => actions.onDismiss(concern)}
        >
          Not an issue
        </button>
      </div>
    </li>
  )
}

const FOLD_WORDS = { true: 'hide', false: 'show' } as const

/** The concerns you dismissed, folded under a line; each can come back. */
function DismissedList({
  dismissed,
  onRestore,
}: {
  dismissed: readonly DismissedConcern[]
  onRestore: (entry: DismissedConcern) => void
}) {
  const [open, setOpen] = useState(false)
  if (dismissed.length === 0) {
    return null
  }
  return (
    <div className="mt-3 border-t border-line pt-2 text-[12px] text-muted">
      <button type="button" className="btn btn-ghost px-1 py-0" onClick={() => setOpen(!open)}>
        {dismissed.length} marked not an issue · {FOLD_WORDS[String(open) as 'true' | 'false']}
      </button>
      {Boolean(open) && (
        <ul className="mt-1 space-y-1">
          {dismissed.map((entry) => (
            <li key={`${entry.path}:${entry.line}:${entry.title}`} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate">
                {entry.title} <span className="font-mono text-[11px]">{entry.path}</span>
              </span>
              <button type="button" className="btn btn-ghost shrink-0 py-0" onClick={() => onRestore(entry)}>
                Bring back
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** What the concerns card needs from the briefing panel: jumping, drafting, dismissing, and the diff to quote. */
interface ConcernActions {
  onJump: Jump
  onDraft: (path: string, line: number, body: string) => void
  /** Marks a concern as not an issue: hidden here, and kept out of later briefings of the PR. */
  onDismiss: (concern: Concern) => void
  onRestore: (entry: DismissedConcern) => void
  validLine: (path: string, line: number) => boolean
  /** The file's diff, for showing the code a concern points at. */
  patchOf: (path: string) => string | undefined
}

/** Adds a question to the review summary; once there, says so instead. */
function AddQuestionButton({ added, onAdd }: { added: boolean; onAdd: () => void }) {
  if (added) {
    return (
      <span className="shrink-0 text-[11.5px] text-ok" title="In the summary of the review you submit">
        ✓ in review summary
      </span>
    )
  }
  return (
    <button
      type="button"
      className="btn btn-ghost hidden shrink-0 py-0 group-hover:inline-flex"
      title="Add this question to the summary of the review you submit"
      onClick={onAdd}
    >
      + to review summary
    </button>
  )
}

export type Jump = (path: string, line?: number | null) => void

export function Card({
  title,
  tone = 'plain',
  children,
}: {
  title: string
  tone?: CardTone
  children: React.ReactNode
}) {
  return (
    <section className="card">
      <h3 className={joinClassNames('border-b border-line px-4 py-2 text-[12px] font-semibold', CARD_TONES[tone])}>
        {title}
      </h3>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

export function FocusCard({ focus, onJump }: { focus: readonly FocusItem[]; onJump: Jump }) {
  return (
    <Card title="Review these" tone="focus">
      <ul className="space-y-1.5">
        {focus.map((focusItem) => (
          <li key={`${focusItem.path}:${focusItem.lines}`} className="flex gap-2">
            <span
              className={joinClassNames('mt-1.5 size-1.5 shrink-0 rounded-full', PRIORITY_DOTS[focusItem.priority])}
            />
            <div className="min-w-0">
              <button
                type="button"
                className="font-mono text-[12px] text-accent hover:underline"
                onClick={() => onJump(focusItem.path, readFirstLine(focusItem.lines))}
              >
                {focusItem.path}
                {Boolean(focusItem.lines) && `:${focusItem.lines}`}
              </button>
              <div className="text-muted">{focusItem.reason}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** The possible issues, the surest first, without those you marked not an issue (listed below, to bring back). */
export function ConcernsCard(
  props: ConcernActions & { concerns: readonly Concern[]; dismissed: readonly DismissedConcern[] },
) {
  const shown = keepUndismissed(props.concerns, props.dismissed)
  return (
    <Card title="Possible issues" tone="danger">
      {shown.length === 0 && <p className="text-muted">None left.</p>}
      <ul className="space-y-3">
        {shown.map((concern) => (
          <ConcernItem
            key={`${concern.path}:${concern.line}:${concern.title}`}
            concern={concern}
            patch={findConcernPatch(concern, props.patchOf)}
            canDraft={Boolean(concern.path) && concern.line !== null && props.validLine(concern.path, concern.line)}
            actions={props}
          />
        ))}
      </ul>
      <DismissedList dismissed={props.dismissed} onRestore={props.onRestore} />
    </Card>
  )
}

export function QuestionsCard({
  questions,
  summary,
  onAdd,
}: {
  questions: readonly string[]
  summary: string
  onAdd: (text: string) => void
}) {
  return (
    <Card title="Ask the author">
      <ul className="space-y-1.5">
        {questions.map((question) => (
          <li key={question} className="group flex items-start gap-2">
            <span className="text-muted">?</span>
            <span className="flex-1 selectable">{question}</span>
            <AddQuestionButton added={hasSummaryLine(summary, question)} onAdd={() => onAdd(question)} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function GuidesCard({ checks }: { checks: readonly GuidelineCheck[] }) {
  return (
    <Card title="Against your guides">
      <ul className="space-y-1.5">
        {checks.map((check) => (
          <li key={check.guideline} className="flex gap-2">
            <span className={CHECK_LOOK[check.status].className}>{CHECK_LOOK[check.status].mark}</span>
            <span>
              <span className="font-medium">{check.guideline}</span> <span className="text-muted">— {check.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function SkimCard({ ignore }: { ignore: Briefing['ignore'] }) {
  return (
    <Card title="Safe to skim">
      <ul className="space-y-1">
        {ignore.map((skipped) => (
          <li key={skipped.path} className="flex gap-2 text-muted">
            <span className="font-mono text-[12px]">{skipped.path}</span>
            <span>— {skipped.reason}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
