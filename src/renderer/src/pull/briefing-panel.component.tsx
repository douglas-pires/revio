import type { BriefingRecord } from '@shared/claude.types'
import { ago, cx } from '../common/format.util'
import { Markdown } from '../common/markdown.component'

const RISK = {
  low: 'bg-ok/15 text-ok',
  medium: 'bg-warn/15 text-warn',
  high: 'bg-danger/15 text-danger',
}

export function BriefingPanel(props: {
  record?: BriefingRecord
  headSha: string
  loading: boolean
  progress: string | null
  error: string | null
  onGenerate: () => void
  onJump: (path: string, line?: number | null) => void
  onDraft: (path: string, line: number, body: string) => void
  onAddToSummary: (text: string) => void
  validLine: (path: string, line: number) => boolean
}) {
  const { record } = props
  const outdated = record && record.headSha !== props.headSha

  if (!record)
    return (
      <div className="rounded-lg border border-dashed border-line p-6 text-center">
        <p className="mb-1 font-medium">Get the gist before you dive in</p>
        <p className="mx-auto mb-4 max-w-md text-muted">
          Claude reads the description, the full diff and your review guides, then tells you what this PR does, where to look, and what to skip.
        </p>
        <button className="btn btn-primary" disabled={props.loading} onClick={props.onGenerate}>
          {props.loading ? 'Reading the PR…' : '✦ Brief me'}
        </button>
        {props.loading && props.progress && <p className="mt-3 text-[12px] text-muted">{props.progress}</p>}
        {props.error && <p className="selectable mt-3 text-danger">{props.error}</p>}
      </div>
    )

  const b = record.briefing
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <span className={cx('chip', RISK[b.risk])}>{b.risk} risk</span>
        <span>
          {record.model} · {record.backend === 'api' ? 'API' : 'Claude Code'} · {ago(record.createdAt)} ago
        </span>
        {outdated && <span className="chip bg-warn/15 text-warn">new commits since</span>}
        <div className="flex-1" />
        <button className="btn" disabled={props.loading} onClick={props.onGenerate}>
          {props.loading ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>
      {props.loading && props.progress && <p className="text-[12px] text-muted">{props.progress}</p>}
      {props.error && <p className="selectable text-danger">{props.error}</p>}

      <Card title="Gist">
        <p className="mb-2 text-muted italic">{b.intent}</p>
        <Markdown>{b.gist}</Markdown>
      </Card>

      {b.focus.length > 0 && (
        <Card title="Review these" tone="focus">
          <ul className="space-y-1.5">
            {b.focus.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className={cx('mt-1.5 size-1.5 shrink-0 rounded-full', f.priority === 'high' ? 'bg-danger' : f.priority === 'medium' ? 'bg-warn' : 'bg-muted')} />
                <div className="min-w-0">
                  <button className="font-mono text-[12px] text-accent hover:underline" onClick={() => props.onJump(f.path, Number(f.lines.split('-')[0]) || null)}>
                    {f.path}
                    {f.lines && `:${f.lines}`}
                  </button>
                  <div className="text-muted">{f.reason}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {b.concerns.length > 0 && (
        <Card title="Possible issues" tone="danger">
          <ul className="space-y-3">
            {b.concerns.map((c, i) => {
              const canDraft = !!c.path && c.line != null && props.validLine(c.path, c.line)
              return (
                <li key={i}>
                  <div className="font-medium">{c.title}</div>
                  <Markdown className="text-muted">{c.detail}</Markdown>
                  <div className="mt-1 flex gap-2">
                    {c.path && (
                      <button className="btn btn-ghost py-0 font-mono text-[11.5px]" onClick={() => props.onJump(c.path, c.line)}>
                        {c.path}
                        {c.line != null && `:${c.line}`}
                      </button>
                    )}
                    {canDraft && (
                      <button className="btn py-0" onClick={() => props.onDraft(c.path, c.line!, `${c.title}\n\n${c.detail}`)}>
                        + Draft comment
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {b.questions.length > 0 && (
        <Card title="Ask the author">
          <ul className="space-y-1.5">
            {b.questions.map((q, i) => (
              <li key={i} className="group flex items-start gap-2">
                <span className="text-muted">?</span>
                <span className="flex-1 selectable">{q}</span>
                <button className="btn btn-ghost hidden py-0 group-hover:inline-flex" onClick={() => props.onAddToSummary(q)}>
                  + to review
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {b.guidelineChecks.length > 0 && (
        <Card title="Against your guides">
          <ul className="space-y-1.5">
            {b.guidelineChecks.map((g, i) => (
              <li key={i} className="flex gap-2">
                <span className={g.status === 'ok' ? 'text-ok' : g.status === 'concern' ? 'text-danger' : 'text-warn'}>
                  {g.status === 'ok' ? '✓' : g.status === 'concern' ? '!' : '?'}
                </span>
                <span>
                  <span className="font-medium">{g.guideline}</span> <span className="text-muted">— {g.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {b.ignore.length > 0 && (
        <Card title="Safe to skim">
          <ul className="space-y-1">
            {b.ignore.map((f, i) => (
              <li key={i} className="flex gap-2 text-muted">
                <span className="font-mono text-[12px]">{f.path}</span>
                <span>— {f.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {record.omittedFiles.length > 0 && (
        <p className="text-[12px] text-muted">
          Not sent to Claude (binary or too large): {record.omittedFiles.join(', ')}
        </p>
      )}
    </div>
  )
}

function Card({ title, tone, children }: { title: string; tone?: 'focus' | 'danger'; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-panel">
      <h3
        className={cx(
          'border-b border-line px-4 py-2 text-[11px] font-semibold tracking-wide uppercase',
          tone === 'focus' ? 'text-focus' : tone === 'danger' ? 'text-danger' : 'text-muted',
        )}
      >
        {title}
      </h3>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}
