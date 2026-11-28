import type { FocusRail, Settings, SettingsPatch } from '@shared/settings.types.ts'
import { useCallback, useEffect, useState } from 'react'
import { Row } from './settings-form.component.tsx'

type Update = (patch: SettingsPatch) => Promise<void>

const RAIL_CHOICES: { value: FocusRail; label: string }[] = [
  { value: 'quiet', label: 'Show it without counts' },
  { value: 'hidden', label: 'Hide it' },
  { value: 'shown', label: 'Show it as usual' },
]

/** Your shortcuts in the Shortcuts app; null while asking. `reload` asks again, after you make one. */
function useShortcutNames() {
  const [names, setNames] = useState<string[] | null>(null)
  const reload = useCallback(() => {
    globalThis.revio.listShortcuts().then(setNames)
  }, [])
  useEffect(reload, [reload])
  return { names, reload }
}

/** A list of your shortcuts to pick one from; "None" leaves Do Not Disturb alone. */
function ShortcutPicker(props: { label: string; value: string; names: string[]; onChange: (name: string) => void }) {
  // A chosen shortcut since renamed or deleted still shows, so it can be seen and changed.
  const names = props.value && !props.names.includes(props.value) ? [props.value, ...props.names] : props.names
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{props.label}</span>
      <select className="input w-64" value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="">None</option>
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Which shortcuts turn Do Not Disturb on and off during a block, and how to make them. */
function DoNotDisturbRow({ settings, update }: { settings: Settings; update: Update }) {
  const shortcuts = useShortcutNames()
  return (
    <Row
      label="Do Not Disturb"
      hint="Macs can only change Focus through Shortcuts. In the Shortcuts app, make one shortcut with the “Set Focus” action turning Do Not Disturb on, and another turning it off, then pick them here. Revio runs the first when a block starts or resumes, and the second when it pauses or ends, or when you quit."
    >
      <div className="flex flex-col gap-2">
        <ShortcutPicker
          label="Turn on with"
          value={settings.dndOnShortcut}
          names={shortcuts.names ?? []}
          onChange={(name) => update({ dndOnShortcut: name })}
        />
        <ShortcutPicker
          label="Turn off with"
          value={settings.dndOffShortcut}
          names={shortcuts.names ?? []}
          onChange={(name) => update({ dndOffShortcut: name })}
        />
        <div>
          <button type="button" className="btn btn-ghost" onClick={shortcuts.reload}>
            Refresh the list
          </button>
        </div>
      </div>
    </Row>
  )
}

/** What a review block hides, and whether it silences other apps. */
export function FocusSettings({ settings, update }: { settings: Settings; update: Update }) {
  return (
    <>
      <Row label="Left rail during a review block" hint="Counts on Inbox, My PRs and Mentions can pull you away.">
        <select
          className="input"
          value={settings.focusRail}
          onChange={(event) => update({ focusRail: event.target.value as FocusRail })}
        >
          {RAIL_CHOICES.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </Row>
      <DoNotDisturbRow settings={settings} update={update} />
    </>
  )
}
