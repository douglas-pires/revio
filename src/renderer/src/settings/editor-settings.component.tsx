import type { EditorInfo } from '@shared/editor.types.ts'
import type { Settings, SettingsPatch } from '@shared/settings.types.ts'
import {
  DEFAULT_OPEN_IN_EDITOR_SHORTCUT,
  findShortcutConflict,
  formatShortcut,
  type KeyPress,
  readShortcut,
} from '@shared/shortcut.util.ts'
import { useEffect, useState } from 'react'
import { joinClassNames } from '../common/format.util.ts'

/** Which editor "Open in editor" uses, and where to look for local clones. */
/** The "Automatic" choice, naming the editor it currently picks when one is installed. */
function describeAutomaticChoice(firstInstalled: string | undefined) {
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

/** Keys refused because another shortcut already uses them, and what for. */
interface RejectedShortcut {
  shortcut: string
  conflict: string
}

/** What the recorder button reads: a prompt while recording, the refused keys, else the shortcut or "Off". */
function describeRecorderState(recording: boolean, shortcut: string, rejected: RejectedShortcut | null) {
  if (recording) {
    return 'Press the keys…'
  }
  if (rejected) {
    return formatShortcut(rejected.shortcut)
  }
  return formatShortcut(shortcut) || 'Off'
}

/**
 * Records a shortcut: click, then press the keys. Escape cancels; Backspace or Delete turns it off. Keys another
 * shortcut already uses are refused: they show in red with what uses them, and the old shortcut stays.
 */
function ShortcutRecorder(props: {
  value: string
  onChange: (shortcut: string) => void
  findConflict: (shortcut: string) => string | null
}) {
  const { value, onChange } = props
  const [recording, setRecording] = useState(false)
  const [rejected, setRejected] = useState<RejectedShortcut | null>(null)
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
    if (step.kind !== 'set' || step.shortcut === value) {
      return
    }
    const conflict = props.findConflict(step.shortcut)
    if (conflict) {
      setRejected({ shortcut: step.shortcut, conflict })
      return
    }
    onChange(step.shortcut)
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={joinClassNames(
            'input w-40 text-left font-mono',
            rejected !== null && 'border-danger text-danger focus:border-danger',
          )}
          aria-label="Open in editor shortcut"
          aria-invalid={rejected !== null}
          onClick={() => {
            setRejected(null)
            setRecording(true)
          }}
          onBlur={() => setRecording(false)}
          onKeyDown={recordKey}
        >
          {describeRecorderState(recording, value, rejected)}
        </button>
        {value !== DEFAULT_OPEN_IN_EDITOR_SHORTCUT && (
          <button type="button" className="btn btn-ghost" onClick={() => onChange(DEFAULT_OPEN_IN_EDITOR_SHORTCUT)}>
            Reset to {formatShortcut(DEFAULT_OPEN_IN_EDITOR_SHORTCUT)}
          </button>
        )}
      </div>
      {rejected !== null && (
        <div className="mt-1.5 text-[12px] text-danger">
          {formatShortcut(rejected.shortcut)} is already used for {rejected.conflict}; kept{' '}
          {formatShortcut(value) || 'Off'}.
        </div>
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
        <div className="mb-1.5 font-medium">Open in editor shortcut</div>
        <ShortcutRecorder
          value={settings.openInEditorShortcut}
          onChange={(openInEditorShortcut) => update({ openInEditorShortcut })}
          findConflict={(shortcut) =>
            findShortcutConflict(shortcut, [{ shortcut: settings.gitLogShortcut, action: 'the Git log' }])
          }
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
