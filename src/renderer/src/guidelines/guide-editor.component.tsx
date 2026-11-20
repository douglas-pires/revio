import { useId, useState } from 'react'
import { cx } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { type Draft, defaultTitle } from './guidelines.util.ts'

type Change = (draft: Draft) => void

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

/** Where the guide applies (repository and folder) and its title. */
function ScopeFields({ draft, repos, onChange }: { draft: Draft; repos: readonly string[]; onChange: Change }) {
  const ids = { repo: useId(), repos: useId(), path: useId(), title: useId() }
  return (
    <div className="grid shrink-0 grid-cols-[1fr_1fr_1.4fr] gap-3 border-b border-line px-5 py-3">
      <Field label="Repository" htmlFor={ids.repo}>
        <input
          id={ids.repo}
          className="input font-mono"
          list={ids.repos}
          value={draft.repo}
          placeholder="owner/repo or *"
          onChange={(e) => onChange({ ...draft, repo: e.target.value })}
        />
        <datalist id={ids.repos}>
          <option value="*">All repositories</option>
          {repos.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </Field>
      <Field label="Folder (optional)" htmlFor={ids.path}>
        <input
          id={ids.path}
          className="input font-mono"
          value={draft.path}
          disabled={draft.repo === '*'}
          placeholder="apps/web/"
          onChange={(e) => onChange({ ...draft, path: e.target.value })}
        />
      </Field>
      <Field label="Title" htmlFor={ids.title}>
        <input
          id={ids.title}
          className="input"
          value={draft.title}
          placeholder={defaultTitle(draft)}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </Field>
    </div>
  )
}

/** The guide's markdown: written in a text box (⌘S saves), or previewed. */
function GuideBody({ draft, onChange, onSave }: { draft: Draft; onChange: Change; onSave: () => void }) {
  const [preview, setPreview] = useState(false)
  return (
    <>
      <div className="flex shrink-0 items-center gap-1 px-5 pt-3">
        <button type="button" className={cx('btn btn-ghost', !preview && 'bg-hover')} onClick={() => setPreview(false)}>
          Write
        </button>
        <button type="button" className={cx('btn btn-ghost', preview && 'bg-hover')} onClick={() => setPreview(true)}>
          Preview
        </button>
        <span className="ml-2 text-muted">
          Markdown. Tell Claude (and future you) what matters here and what to ignore.
        </span>
      </div>
      <div className="min-h-0 flex-1 p-5 pt-2">
        {Boolean(preview) && (
          <div className="h-full overflow-y-auto rounded-md border border-line bg-panel p-4">
            <Markdown>{draft.body || '_Empty_'}</Markdown>
          </div>
        )}
        {!preview && (
          <textarea
            aria-label="Guide text"
            className="input h-full resize-none font-mono text-[12.5px] leading-relaxed"
            value={draft.body}
            onChange={(e) => onChange({ ...draft, body: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 's' && e.metaKey) {
                e.preventDefault()
                onSave()
              }
            }}
          />
        )}
      </div>
    </>
  )
}

/** Above a guide with unsaved edits: they are a draft, kept here until saved or thrown away. */
function DraftWarning({ isNew, onDiscard }: { isNew: boolean; onDiscard: () => void }) {
  let what = 'Unsaved changes to this guide.'
  if (isNew) {
    what = 'This new guide is not saved yet.'
  }
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b border-warn/30 bg-warn/10 px-5 py-1.5 text-[12px] text-warn"
    >
      <span className="chip bg-warn/20 py-0 text-[10.5px]">Draft</span>
      <span className="min-w-0 flex-1">
        {what} Revio keeps it as a draft until you save (⌘S) or discard it; Claude only sees saved guides.
      </span>
      <button type="button" className="btn btn-ghost py-0 text-[12px] text-warn" onClick={onDiscard}>
        Discard changes
      </button>
    </div>
  )
}

/** Edits one guide: whether it is on, where it applies, its text, and saving or deleting it. */
export function GuideEditor(props: {
  draft: Draft
  repos: readonly string[]
  saved: boolean
  error: string | null
  /** Edits not saved yet: kept as a draft, shown with a warning. */
  unsaved: boolean
  onChange: Change
  onSave: () => void
  onDiscard: () => void
  onDelete: () => void
}) {
  const { draft, onChange } = props
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="drag flex h-12 shrink-0 items-center gap-2 border-b border-line px-5">
        <div className="flex-1" />
        {Boolean(props.saved) && <span className="text-ok">Saved</span>}
        {props.error !== null && <span className="text-danger">{props.error}</span>}
        <label className="no-drag flex items-center gap-1.5 text-muted">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => onChange({ ...draft, enabled: e.target.checked })}
          />
          Enabled
        </label>
        {Boolean(draft.id) && (
          <button type="button" className="btn btn-ghost no-drag text-danger" onClick={props.onDelete}>
            Delete
          </button>
        )}
        <button type="button" className="btn btn-primary no-drag" onClick={props.onSave}>
          Save
        </button>
      </header>
      {Boolean(props.unsaved) && <DraftWarning isNew={!draft.id} onDiscard={props.onDiscard} />}
      <ScopeFields draft={draft} repos={props.repos} onChange={onChange} />
      <GuideBody draft={draft} onChange={onChange} onSave={props.onSave} />
    </section>
  )
}
