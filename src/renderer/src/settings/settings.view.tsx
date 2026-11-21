import type { Settings as AppSettings, SettingsPatch } from '@shared/settings.types.ts'
import { useCallback, useEffect, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { Screen, ScreenBody, ScreenHeader } from '../common/screen.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'
import { useAsyncAction } from '../common/use-async-action.hook.ts'
import { UpdateSettings } from '../updates/update-settings.component.tsx'
import { EditorSettings } from './editor-settings.component.tsx'
import { GithubTokenSettings } from './github-token-settings.component.tsx'
import { SyncSettings } from './sync-settings.component.tsx'
import { useSyncStatus } from './use-sync-status.hook.ts'

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionHeading title={title} />
      <div className="card divide-y divide-line">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="mb-1.5 font-medium">{label}</div>
      {children}
      {Boolean(hint) && <div className="mt-1.5 text-[12px] text-muted">{hint}</div>}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between px-4 py-3">
      <span>{label}</span>
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

function Num(props: { label: string; unit: string; value: number; min: number; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center justify-between px-4 py-3">
      <span>{props.label}</span>
      <span className="flex items-center gap-2 text-muted">
        <input
          type="number"
          min={props.min}
          className="input w-20 text-right"
          defaultValue={props.value}
          onBlur={(event) => {
            const parsed = Number(event.target.value)
            if (Number.isFinite(parsed) && parsed >= props.min && parsed !== props.value) {
              props.onChange(parsed)
            }
          }}
        />
        {props.unit}
      </span>
    </label>
  )
}

type Update = (patch: SettingsPatch) => Promise<void>

/** How long "Saved" shows after a change. */
const SAVED_NOTICE_MS = 1200

function describeApiKeyHint(hasKey: boolean) {
  if (hasKey) {
    return 'A key is stored in the macOS keychain.'
  }
  return 'Optional. Falls back to ANTHROPIC_API_KEY or an `ant auth login` profile.'
}

/** What the test notification did, as a hint under the button; nothing before the first test. */
function describeTestResult(wasShown: boolean | null) {
  if (wasShown === null) {
    return null
  }
  if (wasShown) {
    return 'Sent. If nothing appeared, check System Settings → Notifications → Revio.'
  }
  return 'macOS did not show it. Turn on notifications for Revio in System Settings → Notifications.'
}

/** Sends a sample notification, which also makes macOS ask for (and list) Revio's notification permission. */
function TestNotification() {
  const sending = useAsyncAction()
  const [wasShown, setWasShown] = useState<boolean | null>(null)
  const resultText = describeTestResult(wasShown)
  const sendTestNotification = () =>
    sending.run(async () => {
      setWasShown(await globalThis.revio.testNotification())
    })
  return (
    <div className="flex flex-col gap-1">
      <div>
        <button type="button" className="btn" disabled={sending.busy} onClick={sendTestNotification}>
          Send a test notification
        </button>
      </div>
      {resultText !== null && <p className="text-[12px] text-muted">{resultText}</p>}
      {Boolean(sending.error) && <p className="text-[12px] text-danger">{sending.error}</p>}
    </div>
  )
}

/** Which notifications to show, how often to poll, and when a review turns stale. */
function AlertsGroup({ settings, update }: { settings: AppSettings; update: Update }) {
  return (
    <Group title="Alerts">
      <Toggle
        label="Notify when a review is requested"
        checked={settings.notifyOnRequest}
        onChange={(checked) => update({ notifyOnRequest: checked })}
      />
      <Toggle
        label="Notify when a review is requested again on a PR you already reviewed"
        checked={settings.notifyOnReRequest}
        onChange={(checked) => update({ notifyOnReRequest: checked })}
      />
      <Toggle
        label="Notify when a review goes stale"
        checked={settings.notifyOnStale}
        onChange={(checked) => update({ notifyOnStale: checked })}
      />
      <Toggle
        label="Notify when you or your team are mentioned on a PR"
        checked={settings.notifyOnMention}
        onChange={(checked) => update({ notifyOnMention: checked })}
      />
      <TestNotification />
      <Num
        label="Check GitHub every"
        unit="minutes"
        value={settings.pollIntervalMinutes}
        min={1}
        onChange={(minutes) => update({ pollIntervalMinutes: minutes })}
      />
      <Num
        label="Stale after"
        unit="hours"
        value={settings.staleAfterHours}
        min={1}
        onChange={(hours) => update({ staleAfterHours: hours })}
      />
      <Num
        label="Repeat stale alert every"
        unit="hours (0 = once)"
        value={settings.staleRepeatHours}
        min={0}
        onChange={(hours) => update({ staleRepeatHours: hours })}
      />
    </Group>
  )
}

/** How to reach Claude, which model, and the optional API key. */
function ClaudeGroup({ settings, update }: { settings: AppSettings; update: Update }) {
  const [apiKey, setApiKey] = useState('')
  return (
    <Group title="Claude">
      <Row
        label="Connection"
        hint="Auto uses the Anthropic API when a key is set, otherwise your local Claude Code login (`claude -p`)."
      >
        <select
          className="input"
          value={settings.claudeBackend}
          onChange={(event) => update({ claudeBackend: event.target.value as AppSettings['claudeBackend'] })}
        >
          <option value="auto">Auto</option>
          <option value="cli">Claude Code CLI (your subscription)</option>
          <option value="api">Anthropic API key</option>
        </select>
      </Row>
      <Row label="Model">
        <input
          className="input font-mono"
          defaultValue={settings.claudeModel}
          onBlur={(event) => {
            if (event.target.value) {
              update({ claudeModel: event.target.value.trim() })
            }
          }}
        />
      </Row>
      <Row label="Anthropic API key" hint={describeApiKeyHint(settings.hasAnthropicKey)}>
        <div className="flex gap-2">
          <input
            className="input font-mono"
            type="password"
            placeholder="sk-ant-…"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <button
            type="button"
            className="btn"
            disabled={!apiKey}
            onClick={() => update({ anthropicApiKey: apiKey }).then(() => setApiKey(''))}
          >
            Save
          </button>
          {Boolean(settings.hasAnthropicKey) && (
            <button type="button" className="btn btn-ghost" onClick={() => update({ anthropicApiKey: null })}>
              Clear
            </button>
          )}
        </div>
      </Row>
    </Group>
  )
}

export function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // Bumped when another Mac's settings come in, so the fields that keep their own text show the new values.
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => {
    globalThis.revio.getSettings().then((next) => {
      setSettings(next)
      setRevision((previousRevision) => previousRevision + 1)
    })
  }, [])
  const syncStatus = useSyncStatus(reload)

  useEffect(() => {
    globalThis.revio.getSettings().then(setSettings)
  }, [])

  const update = async (patch: SettingsPatch) => {
    try {
      setSettings(await globalThis.revio.updateSettings(patch))
      setMsg('Saved')
      setTimeout(() => setMsg(null), SAVED_NOTICE_MS)
    } catch (failure) {
      setMsg(readErrorMessage(failure))
    }
  }

  if (!settings) {
    return null
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title="Settings"
          subtitle="GitHub, alerts, your editor, Claude and sync"
          actions={Boolean(msg) && <span className="text-muted">{msg}</span>}
        />
      }
    >
      <ScreenBody narrow={true}>
        <div className="space-y-8">
          <Group title="Updates">
            <UpdateSettings />
          </Group>

          <Group title="GitHub">
            <GithubTokenSettings onSaved={() => globalThis.revio.getSettings().then(setSettings)} />
            <Toggle
              label="Include team review requests"
              checked={settings.includeTeamRequests}
              onChange={(checked) => update({ includeTeamRequests: checked })}
            />
            <Toggle
              label="Hide draft PRs"
              checked={settings.ignoreDrafts}
              onChange={(checked) => update({ ignoreDrafts: checked })}
            />
          </Group>

          <Group title="Editor">
            <EditorSettings settings={settings} update={update} />
          </Group>

          <AlertsGroup key={`alerts-${revision}`} settings={settings} update={update} />

          <ClaudeGroup key={`claude-${revision}`} settings={settings} update={update} />

          <Group title="Sync">
            <SyncSettings settings={settings} status={syncStatus} update={update} />
          </Group>
        </div>
      </ScreenBody>
    </Screen>
  )
}
