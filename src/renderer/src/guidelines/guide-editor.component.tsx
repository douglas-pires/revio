import { buildDefaultTitle } from '@shared/guide-title.util.ts'
import { formatShortcut, matchesShortcut } from '@shared/shortcut.util.ts'
import { useId, useState } from 'react'
import { Markdown } from '../common/markdown.component.tsx'
import { SegmentedControl } from '../common/segmented-control.component.tsx'
import { ShortcutHint } from '../shortcuts/shortcut-hint.component.tsx'
import { useShortcuts } from '../shortcuts/shortcuts.context.ts'
import type { Draft } from './guidelines.util.ts'

type Change = (draft: Draft) => void

const BODY_MODES = [
  { value: 'write', label: 'Write' },
  { value: 'preview', label: 'Preview' },
] as const

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
          onChange={(event) => onChange({ ...draft, repo: event.target.value })}
        />
        <datalist id={ids.repos}>
          <option value="*">All repositories</option>
          {repos.map((repo) => (
            <option key={repo} value={repo} />
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
          onChange={(event) => onChange({ ...draft, path: event.target.value })}
        />
      </Field>
      <Field label="Title" htmlFor={ids.title}>
        <input
          id={ids.title}
          className="input"
          value={draft.title}
          placeholder={buildDefaultTitle(draft)}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </Field>
    </div>
  )
}

/** The guide's markdown: written in a text box (its shortcut saves), or previewed. */
function GuideBody(props: { draft: Draft; onChange: Change; onSave: () => void; actions: React.ReactNode }) {
  const { draft, onChange, onSave } = props
  const { shortcuts } = useShortcuts()
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const preview = mode === 'preview'
  return (
    <>
      <div className="flex shrink-0 items-center gap-3 px-5 pt-3">
        <SegmentedControl segments={BODY_MODES} value={mode} onChange={setMode} />
        <span className="min-w-0 truncate text-muted">
          Markdown. Tell Claude (and future you) what matters here and what to ignore.
        </span>
        <div className="flex-1" />
        <div className="flex shrink-0 items-center gap-2">{props.actions}</div>
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
            onChange={(event) => onChange({ ...draft, body: event.target.value })}
            onKeyDown={(event) => {
              if (matchesShortcut(event, shortcuts['save-guide'])) {
                event.preventDefault()
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
  const { shortcuts } = useShortcuts()
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
        {what} Revio keeps it as a draft until you save ({formatShortcut(shortcuts['save-guide'])}) or discard it;
        Claude only sees saved guides.
      </span>
      <button type="button" className="btn btn-ghost py-0 text-[12px] text-warn" onClick={onDiscard}>
        Discard changes
      </button>
    </div>
  )
}

/** Saved / the error, whether the guide is on, and deleting or saving it. */
function GuideActions(props: {
  draft: Draft
  saved: boolean
  error: string | null
  onChange: Change
  onSave: () => void
  onDelete: () => void
}) {
  const { draft } = props
  return (
    <>
      {Boolean(props.saved) && <span className="text-ok">Saved</span>}
      {props.error !== null && <span className="text-danger">{props.error}</span>}
      <label className="flex items-center gap-1.5 text-muted">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => props.onChange({ ...draft, enabled: event.target.checked })}
        />
        Enabled
      </label>
      {Boolean(draft.id) && (
        <button type="button" className="btn btn-ghost text-danger" onClick={props.onDelete}>
          Delete
        </button>
      )}
      <ShortcutHint action="save-guide">
        <button type="button" className="btn btn-primary" onClick={props.onSave}>
          Save
        </button>
      </ShortcutHint>
    </>
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
      {Boolean(props.unsaved) && <DraftWarning isNew={!draft.id} onDiscard={props.onDiscard} />}
      <ScopeFields draft={draft} repos={props.repos} onChange={onChange} />
      <GuideBody draft={draft} onChange={onChange} onSave={props.onSave} actions={<GuideActions {...props} />} />
    </section>
  )
}
