import { useEffect, useRef, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { showNotice } from '../common/notice.service.ts'
import { PanelHeader } from '../common/panel-header.component.tsx'
import { buildEntryText, buildGuideEntry, listGuideScopes } from './guide-entry.util.ts'

/** Where the entry goes: the comment's repository, unless it was said in several. */
const REPOSITORY_SCOPE = 1

/**
 * Turns a review comment into a line of a review guide, so the next briefing checks for it and you need not write it
 * again. You pick the guide (the file's folder, its repository or all of them) and can reword the point first.
 */
export function GuideEntryDialog(props: { repo: string; path: string; comment: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const scopes = listGuideScopes(props.repo, props.path)
  const [scopeIndex, setScopeIndex] = useState(Math.min(REPOSITORY_SCOPE, scopes.length - 1))
  const [text, setText] = useState(() => buildEntryText(props.comment))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const scope = scopes[scopeIndex] ?? scopes[0]
  const save = async () => {
    if (!(scope && text.trim())) {
      return
    }
    try {
      const guide = await globalThis.revio.addGuideEntry(buildGuideEntry(scope, text))
      showNotice(`Added to the review guide “${guide.title}”`)
      dialog.current?.close()
    } catch (failure) {
      setError(readErrorMessage(failure))
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-label="Add to a review guide"
      className="m-auto w-[min(560px,90vw)] overflow-hidden rounded-lg border border-line bg-bg p-0 text-fg shadow-2xl backdrop:bg-black/40"
      onClose={props.onClose}
      onMouseDown={(event) => event.target === event.currentTarget && dialog.current?.close()}
    >
      <PanelHeader title="Add to a review guide" onClose={() => dialog.current?.close()} closeLabel="Close" />
      <div className="space-y-3 p-4 text-[12.5px]">
        <p className="text-muted">
          Claude checks every review guide when it briefs you, so it will look for this before you have to.
        </p>
        <label className="block">
          <span className="mb-1 block font-medium">Guide</span>
          <select className="input" value={scopeIndex} onChange={(event) => setScopeIndex(Number(event.target.value))}>
            {scopes.map((option, index) => (
              <option key={option.label} value={index}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">What to look for</span>
          <textarea
            className="input min-h-24 resize-y font-sans [field-sizing:content]"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        {error !== null && <p className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={save}>
            Add to guide
          </button>
        </div>
      </div>
    </dialog>
  )
}
