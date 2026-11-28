import type { FocusRail, Settings, SettingsPatch } from '@shared/settings.types.ts'
import { useCallback, useEffect, useState } from 'react'
import { useAsyncAction } from '../common/use-async-action.hook.ts'
import { Row, Toggle } from './settings-form.component.tsx'

type Update = (patch: SettingsPatch) => Promise<void>

const RAIL_CHOICES: { value: FocusRail; label: string }[] = [
  { value: 'quiet', label: 'Show it without counts' },
  { value: 'hidden', label: 'Hide it' },
  { value: 'shown', label: 'Show it as usual' },
]

/** Whether Revio's shortcuts are in the Shortcuts app; null while asking. Asked again when you come back to Revio. */
function useDoNotDisturbReady() {
  const [ready, setReady] = useState<boolean | null>(null)
  const recheck = useCallback(() => {
    globalThis.revio.isDoNotDisturbReady().then(setReady)
  }, [])
  useEffect(() => {
    recheck()
    globalThis.addEventListener('focus', recheck)
    return () => globalThis.removeEventListener('focus', recheck)
  }, [recheck])
  return ready
}

/** Offering Revio's shortcuts to the Shortcuts app, and whether it was offered (so its windows are open). */
function useShortcutOffer() {
  const adding = useAsyncAction()
  const [offered, setOffered] = useState(false)
  const offer = () =>
    adding.run(async () => {
      await globalThis.revio.addDoNotDisturbShortcuts()
      setOffered(true)
    })
  return { offer, offered, busy: adding.busy, error: adding.error }
}

/** Under the switch, once it is on: that it is ready, or the one-time step macOS asks for. */
function DoNotDisturbStatus({ ready, offer }: { ready: boolean | null; offer: ReturnType<typeof useShortcutOffer> }) {
  if (ready === null) {
    return null
  }
  if (ready) {
    return <>Revio turns it on when a block starts or resumes, and off when it pauses or ends, or when you quit.</>
  }
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span>
        Macs only let apps change Do Not Disturb through Shortcuts, so Revio adds two of its own, once.
        {offer.offered && ' Click “Add Shortcut” in each window the Shortcuts app opened.'}
      </span>
      <button type="button" className="btn" disabled={offer.busy} onClick={offer.offer}>
        {offer.offered ? 'Open them again' : "Add Revio's shortcuts"}
      </button>
      {Boolean(offer.error) && <span className="text-danger">{offer.error}</span>}
    </div>
  )
}

/** The Do Not Disturb switch for review blocks; turning it on offers Revio's shortcuts when they are missing. */
function DoNotDisturbSwitch({ settings, update }: { settings: Settings; update: Update }) {
  const ready = useDoNotDisturbReady()
  const offer = useShortcutOffer()
  const switchTo = (checked: boolean) => {
    update({ doNotDisturb: checked })
    if (checked && ready === false) {
      offer.offer()
    }
  }
  return (
    <div>
      <Toggle
        label="Turn on Do Not Disturb during a review block"
        checked={settings.doNotDisturb}
        onChange={switchTo}
      />
      {settings.doNotDisturb && (
        <div className="-mt-1 px-4 pb-3 text-[12px] text-muted">
          <DoNotDisturbStatus ready={ready} offer={offer} />
        </div>
      )}
    </div>
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
      <DoNotDisturbSwitch settings={settings} update={update} />
    </>
  )
}
