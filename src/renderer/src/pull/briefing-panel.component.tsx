import type { Briefing, BriefingRecord } from '@shared/claude.types.ts'
import { formatAge, joinClassNames } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import {
  Card,
  ConcernsCard,
  FocusCard,
  GuidesCard,
  type Jump,
  QuestionsCard,
  SkimCard,
} from './briefing-cards.component.tsx'

const RISK: Record<Briefing['risk'], string> = {
  low: 'bg-ok/15 text-ok',
  medium: 'bg-warn/15 text-warn',
  high: 'bg-danger/15 text-danger',
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
  /** The review summary being written, to show which questions are already in it. */
  summary: string
  validLine: (path: string, line: number) => boolean
  /** The file's diff, for showing the code a concern points at. */
  patchOf: (path: string) => string | undefined
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
        <span className={joinClassNames('chip', RISK[risk])}>{risk} risk</span>
        <span>
          {record.model} · {BACKEND_NAMES[record.backend]} · {formatAge(record.createdAt)} ago
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
  const { briefing } = record
  return (
    <div className="space-y-4">
      <BriefingHeader {...props} record={record} />
      <Card title="Gist">
        <p className="mb-2 text-muted italic">{briefing.intent}</p>
        <Markdown>{briefing.gist}</Markdown>
      </Card>
      {briefing.focus.length > 0 && <FocusCard focus={briefing.focus} onJump={props.onJump} />}
      {briefing.concerns.length > 0 && <ConcernsCard {...props} concerns={briefing.concerns} />}
      {briefing.questions.length > 0 && (
        <QuestionsCard questions={briefing.questions} summary={props.summary} onAdd={props.onAddToSummary} />
      )}
      {briefing.guidelineChecks.length > 0 && <GuidesCard checks={briefing.guidelineChecks} />}
      {briefing.ignore.length > 0 && <SkimCard ignore={briefing.ignore} />}
      {record.omittedFiles.length > 0 && (
        <p className="text-[12px] text-muted">
          Not sent to Claude (binary or too large): {record.omittedFiles.join(', ')}
        </p>
      )}
    </div>
  )
}
