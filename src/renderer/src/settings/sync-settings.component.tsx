import type { Settings, SettingsPatch, SyncStatus } from '@shared/settings.types.ts'
import { useState } from 'react'
import { formatAge, readErrorMessage } from '../common/format.util.ts'

/** Where syncing stands, in words. */
function SyncState({ status, problem }: { status: SyncStatus; problem: string | null }) {
  if (problem) {
    return <span className="text-danger">{problem}</span>
  }
  if (status.state === 'unavailable' || status.state === 'error') {
    return <span className="text-danger">{status.message}</span>
  }
  if (status.state === 'downloading') {
    return 'Waiting for iCloud to download your settings…'
  }
  if (status.state === 'synced' && status.lastSyncedAt) {
    return `Synced ${formatAge(status.lastSyncedAt)} ago`
  }
  return 'Alerts, GitHub filters, Claude connection and model, and your review guides.'
}

/** Settings rows: the sync toggle, where it stands, and what stays on this Mac. */
export function SyncSettings({
  settings,
  status,
  update,
}: {
  settings: Settings
  status: SyncStatus | null
  update: (patch: SettingsPatch) => Promise<void>
}) {
  const [problem, setProblem] = useState<string | null>(null)
  const syncNow = async () => {
    setProblem(null)
    try {
      await globalThis.revio.syncNow()
    } catch (failure) {
      setProblem(readErrorMessage(failure))
    }
  }
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block font-medium">Sync settings and review guides through iCloud</span>
            <span className="block text-[12px] text-muted">
              {status !== null && <SyncState status={status} problem={problem} />}
            </span>
          </span>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-[var(--color-accent)]"
            checked={settings.syncViaIcloud}
            onChange={(event) => update({ syncViaIcloud: event.target.checked })}
          />
        </label>
        {Boolean(settings.syncViaIcloud) && (
          <button type="button" className="btn" onClick={() => syncNow()}>
            Sync now
          </button>
        )}
      </div>
      <div className="px-4 py-3 text-[12px] text-muted">
        Your GitHub token and Anthropic key stay in this Mac’s keychain, and the editor and code folders stay with this
        Mac. When two Macs change the same setting or guide, the later change wins.
      </div>
    </>
  )
}
