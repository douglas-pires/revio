import type { EditorInfo } from '@shared/editor.types.ts'
import type { Settings, SettingsPatch } from '@shared/settings.types.ts'
import { useEffect, useState } from 'react'
import { ShortcutInput } from '../shortcuts/shortcut-input.component.tsx'

/** Which editor "Open in editor" uses, and where to look for local clones. */
/** The "Automatic" choice, naming the editor it currently picks when one is installed. */
function describeAutomaticChoice(firstInstalled: string | undefined) {
  if (!firstInstalled) {
    return 'Automatic'
  }
  return `Automatic (${firstInstalled})`
}

export function EditorSettings({
  settings,
  update,
}: {
  settings: Settings
  update: (patch: SettingsPatch) => Promise<void>
}) {
  const [editors, setEditors] = useState<EditorInfo[] | null>(null)
  useEffect(() => {
    globalThis.revio.listEditors().then(setEditors)
  }, [])
  return (
    <>
      <div className="px-4 py-3">
        <div className="mb-1.5 font-medium">Editor</div>
        <select className="input" value={settings.editor} onChange={(event) => update({ editor: event.target.value })}>
          <option value="">{describeAutomaticChoice(editors?.[0]?.name)}</option>
          {editors?.map((editor) => (
            <option key={editor.id} value={editor.id}>
              {editor.name}
            </option>
          ))}
        </select>
        {Boolean(editors && editors.length === 0) && (
          <div className="mt-1.5 text-[12px] text-danger">No supported editor found in Applications.</div>
        )}
      </div>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="font-medium">Open in editor shortcut</div>
          <ShortcutInput action="open-in-editor" />
        </div>
        <div className="mt-1.5 text-[12px] text-muted">
          Opens the file you are reading, at the selected line, from a PR's Files changed tab. Click the keys to choose
          others.
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="mb-1.5 font-medium">Code folders</div>
        <textarea
          className="input min-h-16 resize-y font-mono"
          placeholder="~/code\n~/work"
          defaultValue={settings.codeFolders.join('\n')}
          onBlur={(event) => {
            const folders = event.target.value
              .split('\n')
              .map((folder) => folder.trim())
              .filter(Boolean)
            if (folders.join('\n') !== settings.codeFolders.join('\n')) {
              update({ codeFolders: folders })
            }
          }}
        />
        <div className="mt-1.5 text-[12px] text-muted">
          One per line. To open a PR's file, Revio looks for a clone of its repository in these folders and your home
          folder, and one level below them. It opens the copy on whatever branch you have checked out.
        </div>
      </div>
    </>
  )
}
