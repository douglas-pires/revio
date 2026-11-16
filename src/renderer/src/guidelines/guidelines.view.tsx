import { useEffect, useMemo, useState } from 'react'
import type { Guideline } from '@shared/types'
import { Markdown } from '../common/markdown.component'
import { cx, errorMessage } from '../common/format.util'

type Draft = Omit<Guideline, 'id' | 'updatedAt'> & { id?: string }

const TEMPLATE = `## Context
What this project/folder is and who owns it.

## Focus on
-

## Safe to skip
-

## House rules
-
`

export function Guidelines({ initialRepo, initialPath }: { initialRepo?: string; initialPath?: string }) {
  const [list, setList] = useState<Guideline[]>([])
  const [repos, setRepos] = useState<string[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = async () => {
    const [l, r] = await Promise.all([window.revio.listGuidelines(), window.revio.knownRepos()])
    setList(l)
    setRepos(r)
    return l
  }

  useEffect(() => {
    void load().then((l) => {
      if (initialRepo) {
        const existing = l.find((g) => g.repo === initialRepo && g.path === (initialPath ?? ''))
        setDraft(existing ?? { repo: initialRepo, path: initialPath ?? '', title: '', body: TEMPLATE, enabled: true })
      } else if (l[0]) setDraft(l[0])
    })
  }, [initialRepo, initialPath])

  const groups = useMemo(() => {
    const m = new Map<string, Guideline[]>()
    for (const g of [...list].sort((a, b) => a.path.localeCompare(b.path))) {
      const k = g.repo === '*' ? 'All repositories' : g.repo
      m.set(k, [...(m.get(k) ?? []), g])
    }
    return [...m.entries()].sort(([a], [b]) => (a === 'All repositories' ? -1 : b === 'All repositories' ? 1 : a.localeCompare(b)))
  }, [list])

  const save = async () => {
    if (!draft) return
    setError(null)
    try {
      const g = await window.revio.saveGuideline({ ...draft, title: draft.title || defaultTitle(draft) })
      await load()
      setDraft(g)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const remove = async () => {
    if (!draft?.id || !confirm(`Delete "${draft.title}"?`)) return
    await window.revio.deleteGuideline(draft.id)
    const l = await load()
    setDraft(l[0] ?? null)
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-panel">
        <header className="drag flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <h1 className="text-[14px] font-semibold">Review guides</h1>
          <button
            className="btn no-drag"
            onClick={() => setDraft({ repo: repos[0] ?? '*', path: '', title: '', body: TEMPLATE, enabled: true })}
          >
            + New
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {groups.map(([repo, items]) => (
            <div key={repo} className="mb-3">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted">{repo}</div>
              {items.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setDraft(g)}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                    draft?.id === g.id ? 'bg-hover' : 'hover:bg-hover/60',
                    !g.enabled && 'opacity-50',
                  )}
                >
                  <span className="font-mono text-[11px] text-muted">{g.path || '/'}</span>
                  <span className="truncate">{g.title}</span>
                </button>
              ))}
            </div>
          ))}
          <p className="px-2 pt-2 text-[11.5px] leading-relaxed text-muted">
            Guides stack from general to specific: <b>All repositories</b> → <b>repo root</b> → <b>folders</b> (e.g.{' '}
            <code>apps/web/</code>). A folder guide applies only when a PR touches files under it, and it is shown to Claude
            alongside the files it covers.
          </p>
        </div>
      </aside>

      {draft ? (
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="drag flex h-12 shrink-0 items-center gap-2 border-b border-line px-5">
            <div className="flex-1" />
            {saved && <span className="text-ok">Saved</span>}
            {error && <span className="text-danger">{error}</span>}
            <label className="no-drag flex items-center gap-1.5 text-muted">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
              Enabled
            </label>
            {draft.id && (
              <button className="btn btn-ghost no-drag text-danger" onClick={remove}>
                Delete
              </button>
            )}
            <button className="btn btn-primary no-drag" onClick={save}>
              Save
            </button>
          </header>
          <div className="grid shrink-0 grid-cols-[1fr_1fr_1.4fr] gap-3 border-b border-line px-5 py-3">
            <Field label="Repository">
              <input
                className="input font-mono"
                list="known-repos"
                value={draft.repo}
                placeholder="owner/repo or *"
                onChange={(e) => setDraft({ ...draft, repo: e.target.value })}
              />
              <datalist id="known-repos">
                <option value="*">All repositories</option>
                {repos.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>
            <Field label="Folder (optional)">
              <input
                className="input font-mono"
                value={draft.path}
                disabled={draft.repo === '*'}
                placeholder="apps/web/"
                onChange={(e) => setDraft({ ...draft, path: e.target.value })}
              />
            </Field>
            <Field label="Title">
              <input
                className="input"
                value={draft.title}
                placeholder={defaultTitle(draft)}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex shrink-0 items-center gap-1 px-5 pt-3">
            <button className={cx('btn btn-ghost', !preview && 'bg-hover')} onClick={() => setPreview(false)}>
              Write
            </button>
            <button className={cx('btn btn-ghost', preview && 'bg-hover')} onClick={() => setPreview(true)}>
              Preview
            </button>
            <span className="ml-2 text-muted">Markdown. Tell Claude (and future you) what matters here and what to ignore.</span>
          </div>
          <div className="min-h-0 flex-1 p-5 pt-2">
            {preview ? (
              <div className="h-full overflow-y-auto rounded-md border border-line bg-panel p-4">
                <Markdown>{draft.body || '_Empty_'}</Markdown>
              </div>
            ) : (
              <textarea
                className="input h-full resize-none font-mono text-[12.5px] leading-relaxed"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 's' && e.metaKey) {
                    e.preventDefault()
                    void save()
                  }
                }}
              />
            )}
          </div>
        </section>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted">Create your first review guide.</div>
      )}
    </div>
  )
}

const defaultTitle = (d: Draft) => (d.repo === '*' ? 'Global' : d.path ? d.path.replace(/\/$/, '') : d.repo.split('/')[1] || 'Guide')

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}
