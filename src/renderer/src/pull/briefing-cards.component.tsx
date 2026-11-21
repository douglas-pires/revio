import type { Briefing, FocusItem } from '@shared/claude.types.ts'
import { joinClassNames } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { CodeSnippet } from './code-snippet.component.tsx'
import { hasSummaryLine } from './pull-view.util.ts'

type Concern = Briefing['concerns'][number]

type GuidelineCheck = Briefing['guidelineChecks'][number]

type CardTone = 'focus' | 'danger' | 'plain'

const CARD_TONES: Record<CardTone, string> = { focus: 'text-focus', danger: 'text-danger', plain: 'text-muted' }

const PRIORITY_DOTS: Record<FocusItem['priority'], string> = {
  high: 'bg-danger',
  medium: 'bg-warn',
  low: 'bg-muted',
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

/** One possible issue: what and why, a link to where, and a shortcut to draft a comment there. */
function ConcernItem({
  concern,
  patch,
  canDraft,
  onJump,
  onDraft,
}: {
  concern: Concern
  patch: string | undefined
  canDraft: boolean
  onJump: Jump
  onDraft: (path: string, line: number, body: string) => void
}) {
  const { line } = concern
  return (
    <li>
      <div className="font-medium">{concern.title}</div>
      <Markdown className="text-muted">{concern.detail}</Markdown>
      {patch !== undefined && line !== null && (
        <CodeSnippet path={concern.path} patch={patch} line={line} onOpen={() => onJump(concern.path, line)} />
      )}
      <div className="mt-1 flex gap-2">
        {Boolean(concern.path) && (
          <button
            type="button"
            className="btn btn-ghost py-0 font-mono text-[11.5px]"
            onClick={() => onJump(concern.path, line)}
          >
            {concern.path}
            {line !== null && `:${line}`}
          </button>
        )}
        {canDraft === true && line !== null && (
          <button
            type="button"
            className="btn py-0"
            onClick={() => onDraft(concern.path, line, `${concern.title}\n\n${concern.detail}`)}
          >
            + Draft comment
          </button>
        )}
      </div>
    </li>
  )
}

/** What the concerns card needs from the briefing panel: jumping, drafting, and the diff to quote. */
interface ConcernActions {
  onJump: Jump
  onDraft: (path: string, line: number, body: string) => void
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

export function ConcernsCard(props: ConcernActions & { concerns: readonly Concern[] }) {
  return (
    <Card title="Possible issues" tone="danger">
      <ul className="space-y-3">
        {props.concerns.map((concern) => (
          <ConcernItem
            key={`${concern.path}:${concern.line}:${concern.title}`}
            concern={concern}
            patch={findConcernPatch(concern, props.patchOf)}
            canDraft={Boolean(concern.path) && concern.line !== null && props.validLine(concern.path, concern.line)}
            onJump={props.onJump}
            onDraft={props.onDraft}
          />
        ))}
      </ul>
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
