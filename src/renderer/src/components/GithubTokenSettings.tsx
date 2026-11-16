import { useEffect, useState } from 'react'
import type { GithubAuthStatus, GithubTokenSource } from '@shared/types'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { cx } from '../lib/format'
import { ErrorBanner } from './ErrorBanner'

/** Classic token with the scopes Revio uses, pre-filled on GitHub's "new token" page. */
const NEW_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo,read:org&description=Revio'
const COPY_GH_LOGIN = 'env -u GITHUB_TOKEN -u GH_TOKEN gh auth token | pbcopy'

const SOURCE_LABEL: Record<GithubTokenSource, string> = {
  settings: 'the token saved here',
  dotenv: 'GITHUB_TOKEN from the project’s .env file (development only)',
  GH_TOKEN: 'the GH_TOKEN environment variable',
  GITHUB_TOKEN: 'the GITHUB_TOKEN environment variable',
  'gh-cli': 'your GitHub CLI login (gh auth token)',
  none: 'nothing',
}

/** Shows which GitHub token Revio uses and lets you paste one; it is verified before it is stored. */
export function GithubTokenSettings({ onSaved }: { onSaved: () => void }) {
  const [status, setStatus] = useState<GithubAuthStatus | null>(null)
  const [token, setToken] = useState('')
  const [reveal, setReveal] = useState(false)
  const { busy, error, run } = useAsyncAction()

  useEffect(() => {
    void window.revio.githubAuthStatus().then(setStatus)
  }, [])

  /** Applies a token change, then shows the resulting status. */
  const change = (action: () => Promise<GithubAuthStatus>) =>
    run(async () => {
      setStatus(await action())
      setToken('')
      onSaved()
    })
  const save = () => change(() => window.revio.saveGithubToken(token))
  const clear = () =>
    change(async () => {
      await window.revio.updateSettings({ githubToken: null })
      return window.revio.githubAuthStatus()
    })

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="font-medium">Access token</div>
      <TokenStatus status={status} />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="input w-full pr-14 font-mono"
            type={reveal ? 'text' : 'password'}
            placeholder={status?.source === 'settings' ? 'Paste a new token to replace the saved one' : 'Paste a token: ghp_… or github_pat_…'}
            spellCheck={false}
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && token.trim() && !busy && void save()}
          />
          <button className="btn-ghost absolute top-1/2 right-1 -translate-y-1/2 rounded px-1.5 text-[11px] text-muted" onClick={() => setReveal(!reveal)}>
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>
        <button className="btn" disabled={!token.trim() || busy} onClick={() => void save()}>
          {busy ? 'Checking…' : 'Save'}
        </button>
        {status?.source === 'settings' && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => void clear()} title="Forget the saved token and fall back to the environment or the GitHub CLI">
            Remove
          </button>
        )}
      </div>
      {error && <div className="text-[12px] text-danger selectable">{error}</div>}
      <div className="space-y-1 text-[12px] text-muted">
        <div>Saved encrypted in the macOS keychain, and used before the .env file, GH_TOKEN, GITHUB_TOKEN and the GitHub CLI. Revio checks it with GitHub first.</div>
        <div>
          Use your GitHub CLI login: run <code className="selectable">{COPY_GH_LOGIN}</code>, then paste.
        </div>
        <div>
          Or{' '}
          <a href={NEW_TOKEN_URL} onClick={(e) => { e.preventDefault(); void window.revio.openExternal(NEW_TOKEN_URL) }} className="text-accent hover:underline">
            create a token on GitHub
          </a>{' '}
          with <code>repo</code> and <code>read:org</code> already ticked.
        </div>
      </div>
    </div>
  )
}

function TokenStatus({ status }: { status: GithubAuthStatus | null }) {
  if (!status) return <div className="text-[12px] text-muted">Checking GitHub…</div>
  if (status.error)
    return (
      <ErrorBanner className="text-[12px]">
        {status.source === 'none' ? 'No GitHub token found.' : `The token from ${SOURCE_LABEL[status.source]} does not work: ${status.error}`}
      </ErrorBanner>
    )
  return (
    <div className="rounded-md border border-line bg-panel-2 px-3 py-2 text-[12px]">
      <div>
        Signed in as <span className="font-semibold">@{status.login}</span> using {SOURCE_LABEL[status.source]}.
      </div>
      <div className="mt-0.5 text-muted">
        {status.scopes ? (
          <>
            Scopes:{' '}
            {status.scopes.length ? status.scopes.map((s) => <code key={s} className={cx('mr-1', /:org$/.test(s) && 'text-ok')}>{s}</code>) : 'none'}
          </>
        ) : (
          'Fine-grained token: GitHub does not report its permissions. Team names need organization Members: read.'
        )}
      </div>
      {status.canSeeTeams === false && (
        <div className="mt-1.5 text-warn">
          This token cannot read team names (it lacks <code>read:org</code>), so team review requests show as <code>@team</code>.
        </div>
      )}
    </div>
  )
}
