import type { Settings as S, SettingsPatch } from '@shared/settings.types.ts'
import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../common/format.util.ts'
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between px-4 py-3">
      <span>{label}</span>
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function Num(props: { label: string; unit: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between px-4 py-3">
      <span>{props.label}</span>
      <span className="flex items-center gap-2 text-muted">
        <input
          type="number"
          min={props.min}
          className="input w-20 text-right"
          defaultValue={props.value}
          onBlur={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v) && v >= props.min && v !== props.value) {
              props.onChange(v)
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

function apiKeyHint(hasKey: boolean) {
  if (hasKey) {
    return 'A key is stored in the macOS keychain.'
  }
  return 'Optional. Falls back to ANTHROPIC_API_KEY or an `ant auth login` profile.'
}

/** What a test notification showed, as a hint under the button. */
function testResultText(shown: boolean | null) {
  if (shown === null) {
    return null
  }
  if (shown) {
    return 'Sent. If nothing appeared, check System Settings → Notifications → Revio.'
  }
  return 'macOS did not show it. Turn on notifications for Revio in System Settings → Notifications.'
}

/** Sends a sample notification, which also makes macOS ask for (and list) Revio's notification permission. */
function TestNotification() {
  const action = useAsyncAction()
  const [shown, setShown] = useState<boolean | null>(null)
  const send = () =>
    action.run(async () => {
      setShown(await globalThis.revio.testNotification())
    })
  return (
    <div className="flex flex-col gap-1">
      <div>
        <button type="button" className="btn" disabled={action.busy} onClick={send}>
          Send a test notification
        </button>
      </div>
      {testResultText(shown) && <p className="text-[12px] text-muted">{testResultText(shown)}</p>}
      {Boolean(action.error) && <p className="text-[12px] text-danger">{action.error}</p>}
    </div>
  )
}

/** Which notifications to show, how often to poll, and when a review turns stale. */
function AlertsGroup({ s, update }: { s: S; update: Update }) {
  return (
    <Group title="Alerts">
      <Toggle
        label="Notify when a review is requested"
        checked={s.notifyOnRequest}
        onChange={(v) => update({ notifyOnRequest: v })}
      />
      <Toggle
        label="Notify when a review is requested again on a PR you already reviewed"
        checked={s.notifyOnReRequest}
        onChange={(v) => update({ notifyOnReRequest: v })}
      />
      <Toggle
        label="Notify when a review goes stale"
        checked={s.notifyOnStale}
        onChange={(v) => update({ notifyOnStale: v })}
      />
      <Toggle
        label="Notify when you or your team are mentioned on a PR"
        checked={s.notifyOnMention}
        onChange={(v) => update({ notifyOnMention: v })}
      />
      <TestNotification />
      <Num
        label="Check GitHub every"
        unit="minutes"
        value={s.pollIntervalMinutes}
        min={1}
        onChange={(v) => update({ pollIntervalMinutes: v })}
      />
      <Num
        label="Stale after"
        unit="hours"
        value={s.staleAfterHours}
        min={1}
        onChange={(v) => update({ staleAfterHours: v })}
      />
      <Num
        label="Repeat stale alert every"
        unit="hours (0 = once)"
        value={s.staleRepeatHours}
        min={0}
        onChange={(v) => update({ staleRepeatHours: v })}
      />
    </Group>
  )
}

/** How to reach Claude, which model, and the optional API key. */
function ClaudeGroup({ s, update }: { s: S; update: Update }) {
  const [apiKey, setApiKey] = useState('')
  return (
    <Group title="Claude">
      <Row
        label="Connection"
        hint="Auto uses the Anthropic API when a key is set, otherwise your local Claude Code login (`claude -p`)."
      >
        <select
          className="input"
          value={s.claudeBackend}
          onChange={(e) => update({ claudeBackend: e.target.value as S['claudeBackend'] })}
        >
          <option value="auto">Auto</option>
          <option value="cli">Claude Code CLI (your subscription)</option>
          <option value="api">Anthropic API key</option>
        </select>
      </Row>
      <Row label="Model">
        <input
          className="input font-mono"
          defaultValue={s.claudeModel}
          onBlur={(e) => {
            if (e.target.value) {
              update({ claudeModel: e.target.value.trim() })
            }
          }}
        />
      </Row>
      <Row label="Anthropic API key" hint={apiKeyHint(s.hasAnthropicKey)}>
        <div className="flex gap-2">
          <input
            className="input font-mono"
            type="password"
            placeholder="sk-ant-…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            type="button"
            className="btn"
            disabled={!apiKey}
            onClick={() => update({ anthropicApiKey: apiKey }).then(() => setApiKey(''))}
          >
            Save
          </button>
          {Boolean(s.hasAnthropicKey) && (
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
  const [s, setS] = useState<S | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // Bumped when another Mac's settings come in, so the fields that keep their own text show the new values.
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => {
    globalThis.revio.getSettings().then((next) => {
      setS(next)
      setRevision((r) => r + 1)
    })
  }, [])
  const syncStatus = useSyncStatus(reload)

  useEffect(() => {
    globalThis.revio.getSettings().then(setS)
  }, [])

  const update = async (patch: SettingsPatch) => {
    try {
      setS(await globalThis.revio.updateSettings(patch))
      setMsg('Saved')
      setTimeout(() => setMsg(null), SAVED_NOTICE_MS)
    } catch (e) {
      setMsg(errorMessage(e))
    }
  }

  if (!s) {
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
            <GithubTokenSettings onSaved={() => globalThis.revio.getSettings().then(setS)} />
            <Toggle
              label="Include team review requests"
              checked={s.includeTeamRequests}
              onChange={(v) => update({ includeTeamRequests: v })}
            />
            <Toggle label="Hide draft PRs" checked={s.ignoreDrafts} onChange={(v) => update({ ignoreDrafts: v })} />
          </Group>

          <Group title="Editor">
            <EditorSettings settings={s} update={update} />
          </Group>

          <AlertsGroup key={`alerts-${revision}`} s={s} update={update} />

          <ClaudeGroup key={`claude-${revision}`} s={s} update={update} />

          <Group title="Sync">
            <SyncSettings settings={s} status={syncStatus} update={update} />
          </Group>
        </div>
      </ScreenBody>
    </Screen>
  )
}
