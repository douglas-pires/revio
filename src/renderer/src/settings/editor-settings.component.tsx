import type { EditorInfo } from '@shared/editor.types.ts'
import type { Settings, SettingsPatch } from '@shared/settings.types.ts'
import { DEFAULT_OPEN_IN_EDITOR_SHORTCUT, formatShortcut, type KeyPress, readShortcut } from '@shared/shortcut.util.ts'
import { useEffect, useState } from 'react'

/** Which editor "Open in editor" uses, and where to look for local clones. */
/** The "Automatic" choice, naming the editor it currently picks when one is installed. */
function automaticLabel(firstInstalled: string | undefined) {
  if (!firstInstalled) {
    return 'Automatic'
  }
  return `Automatic (${firstInstalled})`
}

/** What a key press does while recording a shortcut. */
type RecordingStep = { kind: 'cancel' } | { kind: 'set'; shortcut: string } | { kind: 'wait' }

/** Escape cancels, Backspace or Delete turn the shortcut off, a lone modifier waits for the rest of the keys. */
function interpretRecordingKey(press: KeyPress): RecordingStep {
  if (press.key === 'Escape') {
    return { kind: 'cancel' }
  }
  if (press.key === 'Backspace' || press.key === 'Delete') {
    return { kind: 'set', shortcut: '' }
  }
  const shortcut = readShortcut(press)
  if (shortcut === null) {
    return { kind: 'wait' }
  }
  return { kind: 'set', shortcut }
}

/** What the recorder button reads: a prompt while recording, else the shortcut or "Off". */
function describeRecorderState(recording: boolean, shortcut: string) {
  if (recording) {
    return 'Press the keys…'
  }
  return formatShortcut(shortcut) || 'Off'
}

/** Records a shortcut: click, then press the keys. Escape cancels; Backspace or Delete turns it off. */
function ShortcutRecorder({ value, onChange }: { value: string; onChange: (shortcut: string) => void }) {
  const [recording, setRecording] = useState(false)
  const recordKey = (event: React.KeyboardEvent) => {
    if (!recording) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const step = interpretRecordingKey(event)
    if (step.kind === 'wait') {
      return
    }
    setRecording(false)
    if (step.kind === 'set' && step.shortcut !== value) {
      onChange(step.shortcut)
    }
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="input w-40 text-left font-mono"
        aria-label="Open in editor shortcut"
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={recordKey}
      >
        {describeRecorderState(recording, value)}
      </button>
      {value !== DEFAULT_OPEN_IN_EDITOR_SHORTCUT && (
        <button type="button" className="btn btn-ghost" onClick={() => onChange(DEFAULT_OPEN_IN_EDITOR_SHORTCUT)}>
          Reset to {formatShortcut(DEFAULT_OPEN_IN_EDITOR_SHORTCUT)}
        </button>
      )}
    </div>
  )
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
        <div className="mb-1.5 font-medium">Open in editor shortcut</div>
        <ShortcutRecorder
          value={settings.openInEditorShortcut}
          onChange={(openInEditorShortcut) => update({ openInEditorShortcut })}
        />
        <div className="mt-1.5 text-[12px] text-muted">
          Opens the file you are reading, at the selected line, from a PR's Files changed tab. Click to record new keys;
          Backspace turns it off.
        </div>
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
