import { useEffect, useState } from 'react'
import type { EditorInfo } from '@shared/editor.types'
import type { Settings, SettingsPatch } from '@shared/settings.types'

/** Which editor "Open in editor" uses, and where to look for local clones. */
export function EditorSettings({ settings, update }: { settings: Settings; update: (patch: SettingsPatch) => Promise<void> }) {
  const [editors, setEditors] = useState<EditorInfo[] | null>(null)
  useEffect(() => {
    void window.revio.listEditors().then(setEditors)
  }, [])
  return (
    <>
      <div className="px-4 py-3">
        <div className="mb-1.5 font-medium">Editor</div>
        <select className="input" value={settings.editor} onChange={(e) => void update({ editor: e.target.value })}>
          <option value="">{editors?.[0] ? `Automatic (${editors[0].name})` : 'Automatic'}</option>
          {editors?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {editors && !editors.length && <div className="mt-1.5 text-[12px] text-danger">No supported editor found in Applications.</div>}
      </div>
      <div className="px-4 py-3">
        <div className="mb-1.5 font-medium">Code folders</div>
        <textarea
          className="input min-h-16 resize-y font-mono"
          placeholder={'~/code\n~/work'}
          defaultValue={settings.codeFolders.join('\n')}
          onBlur={(e) => {
            const folders = e.target.value.split('\n').map((f) => f.trim()).filter(Boolean)
            if (folders.join('\n') !== settings.codeFolders.join('\n')) void update({ codeFolders: folders })
          }}
        />
        <div className="mt-1.5 text-[12px] text-muted">
          One per line. To open a PR's file, Revio looks for a clone of its repository in these folders and your home folder, and one level below them. It opens the copy on whatever branch you have checked out.
        </div>
      </div>
    </>
  )
}
