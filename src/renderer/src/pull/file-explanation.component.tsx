import type { FileExplanationRecord } from '@shared/explanation.types.ts'
import { useContext } from 'react'
import { formatAge } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { ExplanationsContext } from './use-explanations.hook.ts'

/** A titled part of the explanation. */
function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</div>
      {children}
    </div>
  )
}

/** Who wrote it and when, and a note when the PR has moved on since. */
function Provenance({ record, headSha }: { record: FileExplanationRecord; headSha: string }) {
  return (
    <span>
      {record.model} · {formatAge(record.createdAt)} ago
      {record.headSha !== headSha && ' · written for an earlier push'}
    </span>
  )
}

function ExplanationParts({ record }: { record: FileExplanationRecord }) {
  const { explanation } = record
  return (
    <div className="space-y-2.5">
      <Part title="What it's for">
        <Markdown className="text-[12.5px]">{explanation.purpose}</Markdown>
      </Part>
      <Part title="How it works">
        <Markdown className="text-[12.5px]">{explanation.howItWorks}</Markdown>
      </Part>
      {explanation.connections.length > 0 && (
        <Part title="Connected to">
          <ul className="space-y-0.5 text-[12.5px]">
            {explanation.connections.map((connection) => (
              <li key={connection.path} className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-mono text-[11.5px]">{connection.path}</span>
                <Markdown className="text-[12px] text-muted">{connection.relation}</Markdown>
              </li>
            ))}
          </ul>
        </Part>
      )}
      <Part title="What this PR changes">
        <Markdown className="text-[12.5px]">{explanation.change}</Markdown>
      </Part>
      {explanation.watchFor.length > 0 && (
        <Part title="Worth checking">
          <ul className="list-disc space-y-0.5 pl-4 text-[12.5px]">
            {explanation.watchFor.map((point) => (
              <li key={point}>
                <Markdown className="text-[12.5px]">{point}</Markdown>
              </li>
            ))}
          </ul>
        </Part>
      )}
    </div>
  )
}

/** Above a file's diff, once asked for: Claude's explanation of the code, its progress, or why it failed. */
export function FileExplanation({ path, headSha }: { path: string; headSha: string }) {
  const explanations = useContext(ExplanationsContext)
  if (!explanations?.shown.has(path)) {
    return null
  }
  const record = explanations.records[path]
  const progress = explanations.progress[path]
  const error = explanations.errors[path]
  return (
    <div className="border-b border-line bg-accent/5 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[11.5px] text-muted">
        <span className="font-semibold text-accent">✦ About this code</span>
        {record !== undefined && progress === undefined && <Provenance record={record} headSha={headSha} />}
        <div className="flex-1" />
        {record !== undefined && progress === undefined && (
          <button type="button" className="btn btn-ghost py-0" onClick={() => explanations.explain(path)}>
            Explain again
          </button>
        )}
        <button type="button" className="btn btn-ghost py-0" onClick={() => explanations.toggle(path)}>
          Hide
        </button>
      </div>
      {progress !== undefined && <p className="text-[12px] text-muted">{progress}</p>}
      {error !== undefined && <p className="text-[12px] text-danger">{error}</p>}
      {record !== undefined && progress === undefined && <ExplanationParts record={record} />}
    </div>
  )
}
