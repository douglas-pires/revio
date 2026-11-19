import type { EditorInfo } from '@shared/editor.types.ts'
import type { Settings, SettingsPatch } from '@shared/settings.types.ts'
import { useEffect, useState } from 'react'

/** Which editor "Open in editor" uses, and where to look for local clones. */
/** The "Automatic" choice, naming the editor it currently picks when one is installed. */
function automaticLabel(firstInstalled: string | undefined) {
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
        <select className="input" value={settings.editor} onChange={(e) => update({ editor: e.target.value })}>
          <option value="">{automaticLabel(editors?.[0]?.name)}</option>
          {editors?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {Boolean(editors && editors.length === 0) && (
          <div className="mt-1.5 text-[12px] text-danger">No supported editor found in Applications.</div>
        )}
      </div>
      <div className="px-4 py-3">
        <div className="mb-1.5 font-medium">Code folders</div>
        <textarea
          className="input min-h-16 resize-y font-mono"
          placeholder="~/code\n~/work"
          defaultValue={settings.codeFolders.join('\n')}
          onBlur={(e) => {
            const folders = e.target.value
              .split('\n')
              .map((f) => f.trim())
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
