import type { FocusRail, Settings, SettingsPatch } from '@shared/settings.types.ts'
import { Row } from './settings-form.component.tsx'

type Update = (patch: SettingsPatch) => Promise<void>

const RAIL_CHOICES: { value: FocusRail; label: string }[] = [
  { value: 'quiet', label: 'Show it without counts' },
  { value: 'hidden', label: 'Hide it' },
  { value: 'shown', label: 'Show it as usual' },
]

/** What a review block hides. */
export function FocusSettings({ settings, update }: { settings: Settings; update: Update }) {
  return (
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
  )
}
