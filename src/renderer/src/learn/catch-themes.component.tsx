import type { CatchTheme } from '@shared/learn.types.ts'
import { useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { GuideEntryDialog } from '../guidelines/guide-entry-dialog.component.tsx'

/** One kind of catch, with its tip and the way to keep the tip in a guide. */
function ThemeRow({ theme, repo }: { theme: CatchTheme; repo: string }) {
  const [adding, setAdding] = useState(false)
  return (
    <li className="border-t border-line px-4 py-2.5 first:border-t-0">
      <div className="flex items-baseline gap-2">
        <span className="font-medium">{theme.name}</span>
        <span className="text-[11.5px] text-muted">{theme.count}</span>
      </div>
      <p className="text-muted">{theme.description}</p>
      <div className="mt-1.5 flex items-start gap-2 rounded-md bg-accent/10 px-2.5 py-1.5">
        <span aria-hidden={true}>💡</span>
        <span className="flex-1">{theme.tip}</span>
        <button type="button" className="btn btn-ghost shrink-0 py-0 text-accent" onClick={() => setAdding(true)}>
          Add to a guide
        </button>
      </div>
      {Boolean(adding) && <GuideEntryDialog repo={repo} path="" comment={theme.tip} onClose={() => setAdding(false)} />}
    </li>
  )
}

/** "What kinds of things do others catch?", and Claude's grouping once asked. */
export function CatchThemes({ repo }: { repo: string }) {
  const [themes, setThemes] = useState<CatchTheme[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ask = async () => {
    setBusy(true)
    setError(null)
    try {
      setThemes(await globalThis.revio.summarizeOtherCatches())
    } catch (failure) {
      setError(readErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  if (themes) {
    return (
      <ul className="card mb-5 text-[12.5px]">
        {themes.map((theme) => (
          <ThemeRow key={theme.name} theme={theme} repo={repo} />
        ))}
      </ul>
    )
  }
  return (
    <div className="mb-5">
      <button type="button" className="btn text-accent" disabled={busy} onClick={ask}>
        {Boolean(busy) && 'Claude is reading their points…'}
        {!busy && '✦ What kinds of things do others catch?'}
      </button>
      {error !== null && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
