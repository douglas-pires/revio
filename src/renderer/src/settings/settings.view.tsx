import { useEffect, useState } from 'react'
import type { Settings as S, SettingsPatch } from '@shared/settings.types'
import { EditorSettings } from './editor-settings.component'
import { GithubTokenSettings } from './github-token-settings.component'
import { errorMessage } from '../common/format.util'
import { UpdateSettings } from '../updates/update-settings.component'

export function Settings() {
  const [s, setS] = useState<S | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void window.revio.getSettings().then(setS)
  }, [])

  const update = async (patch: SettingsPatch) => {
    try {
      setS(await window.revio.updateSettings(patch))
      setMsg('Saved')
      setTimeout(() => setMsg(null), 1200)
    } catch (e) {
      setMsg(errorMessage(e))
    }
  }

  if (!s) return null

  return (
    <div className="flex h-full flex-col">
      <header className="drag flex h-12 shrink-0 items-center border-b border-line px-5">
        <h1 className="text-[14px] font-semibold">Settings</h1>
        <div className="flex-1" />
        {msg && <span className="text-muted">{msg}</span>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-6 py-6">
          <Group title="Updates">
            <UpdateSettings />
          </Group>

          <Group title="GitHub">
            <GithubTokenSettings onSaved={() => void window.revio.getSettings().then(setS)} />
            <Toggle label="Include team review requests" checked={s.includeTeamRequests} onChange={(v) => update({ includeTeamRequests: v })} />
            <Toggle label="Hide draft PRs" checked={s.ignoreDrafts} onChange={(v) => update({ ignoreDrafts: v })} />
          </Group>

          <Group title="Editor">
            <EditorSettings settings={s} update={update} />
          </Group>

          <Group title="Alerts">
            <Toggle label="Notify when a review is requested (or re-requested)" checked={s.notifyOnRequest} onChange={(v) => update({ notifyOnRequest: v })} />
            <Toggle label="Notify when a review goes stale" checked={s.notifyOnStale} onChange={(v) => update({ notifyOnStale: v })} />
            <Toggle label="Notify when you or your team are mentioned on a PR" checked={s.notifyOnMention} onChange={(v) => update({ notifyOnMention: v })} />
            <Num label="Check GitHub every" unit="minutes" value={s.pollIntervalMinutes} min={1} onChange={(v) => update({ pollIntervalMinutes: v })} />
            <Num label="Stale after" unit="hours" value={s.staleAfterHours} min={1} onChange={(v) => update({ staleAfterHours: v })} />
            <Num label="Repeat stale alert every" unit="hours (0 = once)" value={s.staleRepeatHours} min={0} onChange={(v) => update({ staleRepeatHours: v })} />
          </Group>

          <Group title="Claude">
            <Row label="Connection" hint="Auto uses the Anthropic API when a key is set, otherwise your local Claude Code login (`claude -p`).">
              <select className="input" value={s.claudeBackend} onChange={(e) => void update({ claudeBackend: e.target.value as S['claudeBackend'] })}>
                <option value="auto">Auto</option>
                <option value="cli">Claude Code CLI (your subscription)</option>
                <option value="api">Anthropic API key</option>
              </select>
            </Row>
            <Row label="Model">
              <input className="input font-mono" defaultValue={s.claudeModel} onBlur={(e) => e.target.value && void update({ claudeModel: e.target.value.trim() })} />
            </Row>
            <Row label="Anthropic API key" hint={s.hasAnthropicKey ? 'A key is stored in the macOS keychain.' : 'Optional. Falls back to ANTHROPIC_API_KEY or an `ant auth login` profile.'}>
              <div className="flex gap-2">
                <input className="input font-mono" type="password" placeholder="sk-ant-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                <button className="btn" disabled={!apiKey} onClick={() => void update({ anthropicApiKey: apiKey }).then(() => setApiKey(''))}>
                  Save
                </button>
                {s.hasAnthropicKey && (
                  <button className="btn btn-ghost" onClick={() => void update({ anthropicApiKey: null })}>
                    Clear
                  </button>
                )}
              </div>
            </Row>
          </Group>
        </div>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <div className="divide-y divide-line rounded-lg border border-line bg-panel">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="mb-1.5 font-medium">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-[12px] text-muted">{hint}</div>}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between px-4 py-3">
      <span>{label}</span>
      <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
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
            if (Number.isFinite(v) && v >= props.min && v !== props.value) props.onChange(v)
          }}
        />
        {props.unit}
      </span>
    </label>
  )
}
