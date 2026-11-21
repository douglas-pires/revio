import type { ResolvedGuideline } from '@shared/guideline.types.ts'
import type { PullDetail } from '@shared/pull.types.ts'
import type { ReactNode } from 'react'
import { Markdown } from '../common/markdown.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { suggestFolders } from './files.util.ts'

/** Folders offered for a new guide, at most. */
const MAX_FOLDER_SUGGESTIONS = 4

/** Guides matching this PR's files, and up to four folders that could have one. */
function GuidesSection(props: {
  repo: string
  paths: string[]
  guides: readonly ResolvedGuideline[]
  onEdit: (repo: string, path?: string) => void
}) {
  const { repo, guides } = props
  const folders = suggestFolders(props.paths).filter(
    (folder) => !guides.some((guide) => guide.repo === repo && guide.path === folder),
  )
  return (
    <section>
      <SectionHeading
        title="Your guides for this PR"
        action={
          <button type="button" className="btn btn-ghost py-0" onClick={() => props.onEdit(repo)}>
            Edit
          </button>
        }
      />
      <div className="flex flex-wrap gap-2">
        {guides.map((guide) => (
          <button
            type="button"
            key={guide.id}
            className="btn"
            title={guide.body}
            onClick={() => props.onEdit(guide.repo, guide.path)}
          >
            <span className="font-mono text-muted">
              {guide.repo === '*' && '*'}
              {guide.repo !== '*' && (guide.path || '/')}
            </span>{' '}
            {guide.title}
            {Boolean(guide.path) && <span className="text-muted">· {guide.matchedFiles} files</span>}
          </button>
        ))}
        {folders.slice(0, MAX_FOLDER_SUGGESTIONS).map((folder) => (
          <button
            type="button"
            key={folder}
            className="btn btn-ghost border-dashed border-line text-muted"
            onClick={() => props.onEdit(repo, folder)}
          >
            + guide for <span className="font-mono">{folder}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

/** The briefing, the guides that apply, and the PR description. */
export function OverviewTab(props: {
  pr: PullDetail
  guides: readonly ResolvedGuideline[]
  briefing: ReactNode
  mentioned?: ReactNode
  onEditGuidelines: (repo: string, path?: string) => void
}) {
  const { pr } = props
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-5">
      {props.mentioned}
      {props.briefing}
      <GuidesSection
        repo={pr.repo}
        paths={pr.files.map((file) => file.path)}
        guides={props.guides}
        onEdit={props.onEditGuidelines}
      />
      <section>
        <SectionHeading title="Description" />
        <div className="card px-5 py-4">
          <Markdown>{pr.body || '_No description provided._'}</Markdown>
        </div>
      </section>
    </div>
  )
}
