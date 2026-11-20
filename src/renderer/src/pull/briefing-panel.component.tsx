import type { Briefing, BriefingRecord, FocusItem } from '@shared/claude.types.ts'
import { ago, cx } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { CodeSnippet } from './code-snippet.component.tsx'

type Concern = Briefing['concerns'][number]
type GuidelineCheck = Briefing['guidelineChecks'][number]
type Jump = (path: string, line?: number | null) => void
type CardTone = 'focus' | 'danger' | 'plain'

const RISK: Record<Briefing['risk'], string> = {
  low: 'bg-ok/15 text-ok',
  medium: 'bg-warn/15 text-warn',
  high: 'bg-danger/15 text-danger',
}
const CARD_TONES: Record<CardTone, string> = { focus: 'text-focus', danger: 'text-danger', plain: 'text-muted' }
const PRIORITY_DOTS: Record<FocusItem['priority'], string> = { high: 'bg-danger', medium: 'bg-warn', low: 'bg-muted' }
const CHECK_LOOK: Record<GuidelineCheck['status'], { className: string; mark: string }> = {
  ok: { className: 'text-ok', mark: '✓' },
  concern: { className: 'text-danger', mark: '!' },
  unclear: { className: 'text-warn', mark: '?' },
}
const BACKEND_NAMES: Record<BriefingRecord['backend'], string> = { api: 'API', cli: 'Claude Code' }

interface BriefingPanelProps {
  record?: BriefingRecord | undefined
  headSha: string
  loading: boolean
  progress: string | null
  error: string | null
  onGenerate: () => void
  onJump: Jump
  onDraft: (path: string, line: number, body: string) => void
  onAddToSummary: (text: string) => void
  validLine: (path: string, line: number) => boolean
  /** The file's diff, for showing the code a concern points at. */
  patchOf: (path: string) => string | undefined
}

/** The diff of the file a concern names; none when it names no file. */
function patchOfConcern(c: Concern, patchOf: (path: string) => string | undefined) {
  if (!c.path) {
    return
  }
  return patchOf(c.path)
}

/** The first line of a focus range like "42-80", or null for the whole file. */
function firstLineOf(lines: string) {
  return Number(lines.split('-')[0]) || null
}

function Card({ title, tone = 'plain', children }: { title: string; tone?: CardTone; children: React.ReactNode }) {
  return (
    <section className="card">
      <h3 className={cx('border-b border-line px-4 py-2 text-[12px] font-semibold', CARD_TONES[tone])}>{title}</h3>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

/** Status lines under the briefing's buttons: what Claude is doing, or why it failed. */
function GenerateStatus({ loading, progress, error }: Pick<BriefingPanelProps, 'loading' | 'progress' | 'error'>) {
  return (
    <>
      {Boolean(loading && progress !== null) && <p className="mt-3 text-[12px] text-muted">{progress}</p>}
      {error !== null && <p className="selectable mt-3 text-danger">{error}</p>}
    </>
  )
}

/** One possible issue: what and why, a link to where, and a shortcut to draft a comment there. */
function ConcernItem({
  concern: c,
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
  const { line } = c
  return (
    <li>
      <div className="font-medium">{c.title}</div>
      <Markdown className="text-muted">{c.detail}</Markdown>
      {patch !== undefined && line !== null && (
        <CodeSnippet path={c.path} patch={patch} line={line} onOpen={() => onJump(c.path, line)} />
      )}
      <div className="mt-1 flex gap-2">
        {Boolean(c.path) && (
          <button
            type="button"
            className="btn btn-ghost py-0 font-mono text-[11.5px]"
            onClick={() => onJump(c.path, line)}
          >
            {c.path}
            {line !== null && `:${line}`}
          </button>
        )}
        {canDraft === true && line !== null && (
          <button type="button" className="btn py-0" onClick={() => onDraft(c.path, line, `${c.title}\n\n${c.detail}`)}>
            + Draft comment
          </button>
        )}
      </div>
    </li>
  )
}

function FocusCard({ focus, onJump }: { focus: readonly FocusItem[]; onJump: Jump }) {
  return (
    <Card title="Review these" tone="focus">
      <ul className="space-y-1.5">
        {focus.map((f) => (
          <li key={`${f.path}:${f.lines}`} className="flex gap-2">
            <span className={cx('mt-1.5 size-1.5 shrink-0 rounded-full', PRIORITY_DOTS[f.priority])} />
            <div className="min-w-0">
              <button
                type="button"
                className="font-mono text-[12px] text-accent hover:underline"
                onClick={() => onJump(f.path, firstLineOf(f.lines))}
              >
                {f.path}
                {Boolean(f.lines) && `:${f.lines}`}
              </button>
              <div className="text-muted">{f.reason}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ConcernsCard(
  props: Pick<BriefingPanelProps, 'onJump' | 'onDraft' | 'validLine' | 'patchOf'> & {
    concerns: readonly Concern[]
  },
) {
  return (
    <Card title="Possible issues" tone="danger">
      <ul className="space-y-3">
        {props.concerns.map((c) => (
          <ConcernItem
            key={`${c.path}:${c.line}:${c.title}`}
            concern={c}
            patch={patchOfConcern(c, props.patchOf)}
            canDraft={Boolean(c.path) && c.line !== null && props.validLine(c.path, c.line)}
            onJump={props.onJump}
            onDraft={props.onDraft}
          />
        ))}
      </ul>
    </Card>
  )
}

function QuestionsCard({ questions, onAdd }: { questions: readonly string[]; onAdd: (text: string) => void }) {
  return (
    <Card title="Ask the author">
      <ul className="space-y-1.5">
        {questions.map((q) => (
          <li key={q} className="group flex items-start gap-2">
            <span className="text-muted">?</span>
            <span className="flex-1 selectable">{q}</span>
            <button
              type="button"
              className="btn btn-ghost hidden py-0 group-hover:inline-flex"
              onClick={() => onAdd(q)}
            >
              + to review
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function GuidesCard({ checks }: { checks: readonly GuidelineCheck[] }) {
  return (
    <Card title="Against your guides">
      <ul className="space-y-1.5">
        {checks.map((g) => (
          <li key={g.guideline} className="flex gap-2">
            <span className={CHECK_LOOK[g.status].className}>{CHECK_LOOK[g.status].mark}</span>
            <span>
              <span className="font-medium">{g.guideline}</span> <span className="text-muted">— {g.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function SkimCard({ ignore }: { ignore: Briefing['ignore'] }) {
  return (
    <Card title="Safe to skim">
      <ul className="space-y-1">
        {ignore.map((f) => (
          <li key={f.path} className="flex gap-2 text-muted">
            <span className="font-mono text-[12px]">{f.path}</span>
            <span>— {f.reason}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Before any briefing: what it is and the button that asks for one. */
function BriefingInvite(props: BriefingPanelProps) {
  return (
    <div className="rounded-lg border border-dashed border-line p-6 text-center">
      <p className="mb-1 font-medium">Get the gist before you dive in</p>
      <p className="mx-auto mb-4 max-w-md text-muted">
        Claude reads the description, the full diff and your review guides, then tells you what this PR does, where to
        look, and what to skip.
      </p>
      <button type="button" className="btn btn-primary" disabled={props.loading} onClick={props.onGenerate}>
        {Boolean(props.loading) && 'Reading the PR…'}
        {!props.loading && '✦ Brief me'}
      </button>
      <GenerateStatus loading={props.loading} progress={props.progress} error={props.error} />
    </div>
  )
}

/** Risk, which model wrote it and when, whether new commits came since, and the button to regenerate. */
function BriefingHeader({ record, ...props }: BriefingPanelProps & { record: BriefingRecord }) {
  const { risk } = record.briefing
  return (
    <>
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <span className={cx('chip', RISK[risk])}>{risk} risk</span>
        <span>
          {record.model} · {BACKEND_NAMES[record.backend]} · {ago(record.createdAt)} ago
        </span>
        {record.headSha !== props.headSha && <span className="chip bg-warn/15 text-warn">new commits since</span>}
        <div className="flex-1" />
        <button type="button" className="btn" disabled={props.loading} onClick={props.onGenerate}>
          {Boolean(props.loading) && 'Regenerating…'}
          {!props.loading && 'Regenerate'}
        </button>
      </div>
      <GenerateStatus loading={props.loading} progress={props.progress} error={props.error} />
    </>
  )
}

export function BriefingPanel(props: BriefingPanelProps) {
  const { record } = props
  if (!record) {
    return <BriefingInvite {...props} />
  }
  const b = record.briefing
  return (
    <div className="space-y-4">
      <BriefingHeader {...props} record={record} />
      <Card title="Gist">
        <p className="mb-2 text-muted italic">{b.intent}</p>
        <Markdown>{b.gist}</Markdown>
      </Card>
      {b.focus.length > 0 && <FocusCard focus={b.focus} onJump={props.onJump} />}
      {b.concerns.length > 0 && <ConcernsCard {...props} concerns={b.concerns} />}
      {b.questions.length > 0 && <QuestionsCard questions={b.questions} onAdd={props.onAddToSummary} />}
      {b.guidelineChecks.length > 0 && <GuidesCard checks={b.guidelineChecks} />}
      {b.ignore.length > 0 && <SkimCard ignore={b.ignore} />}
      {record.omittedFiles.length > 0 && (
        <p className="text-[12px] text-muted">
          Not sent to Claude (binary or too large): {record.omittedFiles.join(', ')}
        </p>
      )}
    </div>
  )
}
