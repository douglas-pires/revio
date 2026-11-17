import type { ReactNode } from 'react'
import type { ResolvedGuideline } from '@shared/guideline.types'
import type { PullDetail } from '@shared/pull.types'
import { Markdown } from '../common/markdown.component'
import { suggestFolders } from './files.util'

/** The briefing, the guides that apply, and the PR description. */
export function OverviewTab(props: { pr: PullDetail; guides: readonly ResolvedGuideline[]; briefing: ReactNode; onEditGuidelines: (repo: string, path?: string) => void }) {
  const { pr } = props
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-5">
      {props.briefing}
      <GuidesSection repo={pr.repo} paths={pr.files.map((f) => f.path)} guides={props.guides} onEdit={props.onEditGuidelines} />
      <section>
        <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">Description</h3>
        <div className="rounded-lg border border-line bg-panel px-5 py-4">
          <Markdown>{pr.body || '_No description provided._'}</Markdown>
        </div>
      </section>
    </div>
  )
}

/** Guides matching this PR's files, and up to four folders that could have one. */
function GuidesSection(props: { repo: string; paths: string[]; guides: readonly ResolvedGuideline[]; onEdit: (repo: string, path?: string) => void }) {
  const { repo, guides } = props
  const folders = suggestFolders(props.paths).filter((p) => !guides.some((g) => g.repo === repo && g.path === p))
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
        Your guides for this PR
        <button className="btn btn-ghost py-0 font-normal normal-case" onClick={() => props.onEdit(repo)}>
          Edit
        </button>
      </h3>
      <div className="flex flex-wrap gap-2">
        {guides.map((g) => (
          <button key={g.id} className="btn" title={g.body} onClick={() => props.onEdit(g.repo === '*' ? '*' : g.repo, g.path)}>
            <span className="font-mono text-muted">{g.repo === '*' ? '*' : g.path || '/'}</span> {g.title}
            {g.path && <span className="text-muted">· {g.matchedFiles} files</span>}
          </button>
        ))}
        {folders.slice(0, 4).map((p) => (
          <button key={p} className="btn btn-ghost border-dashed border-line text-muted" onClick={() => props.onEdit(repo, p)}>
            + guide for <span className="font-mono">{p}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
