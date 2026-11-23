import type { FeedbackKind, FeedbackResult, SystemInfo } from '@shared/feedback.types.ts'
import { useEffect, useState } from 'react'
import { readErrorMessage } from '../common/format.util.ts'
import { type Segment, SegmentedControl } from '../common/segmented-control.component.tsx'

const KINDS: readonly Segment<FeedbackKind>[] = [
  { value: 'bug', label: 'Bug report' },
  { value: 'feature', label: 'Feature request' },
]

const DESCRIPTION_HINTS: Record<FeedbackKind, string> = {
  bug: 'What did you do, what happened, and what did you expect instead?',
  feature: 'What would you like Revio to do, and what would it help you with?',
}

/** The send button's label, by whether it is sending. */
const SEND_LABELS: Record<string, string> = { true: 'Opening…', false: 'Open issue on GitHub' }

/** The system facts a bug report adds, listed so you see exactly what is sent. */
function SystemInfoList({ info }: { info: SystemInfo }) {
  const rows: [string, string][] = [
    ['Revio', `${info.appVersion} (${info.build})`],
    ['macOS', `${info.os} (${info.arch})`],
    ['Chip', `${info.chip}, ${info.memoryGb} GB`],
    ['Electron', `${info.electron} (Chrome ${info.chrome}, Node ${info.node})`],
    ['Locale', info.locale],
  ]
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 rounded-md bg-panel-2 px-3 py-2 font-mono text-[11.5px]">
      {rows.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-muted">{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** For bug reports: whether to add the system info, with what it is. */
function SystemInfoChoice(props: { include: boolean; onChange: (include: boolean) => void }) {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  useEffect(() => {
    globalThis.revio
      .getSystemInfo()
      .then(setInfo)
      .catch(() => setInfo(null))
  }, [])
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-accent)]"
          checked={props.include}
          onChange={(event) => props.onChange(event.target.checked)}
        />
        Include system info
      </label>
      {props.include && info !== null && <SystemInfoList info={info} />}
    </div>
  )
}

/** What happened after sending: the issue's link, or that GitHub's form opened in the browser. */
function SentNote({ result }: { result: FeedbackResult }) {
  const open = () => globalThis.revio.openExternal(result.url)
  if (result.via === 'browser') {
    return (
      <span className="text-[12px] text-muted">
        Your token could not open the issue, so GitHub's form opened in your browser, filled in.
      </span>
    )
  }
  return (
    <button type="button" className="text-[12px] text-ok hover:underline" onClick={open}>
      Issue opened on GitHub ↗
    </button>
  )
}

/** The form's fields and how sending them goes. */
function useFeedbackForm() {
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [includeSystemInfo, setIncludeSystemInfo] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<FeedbackResult | null>(null)
  const send = async () => {
    setSending(true)
    setError(null)
    try {
      setSent(await globalThis.revio.submitFeedback({ kind, title, description, includeSystemInfo }))
      setTitle('')
      setDescription('')
    } catch (failure) {
      setError(readErrorMessage(failure))
    } finally {
      setSending(false)
    }
  }
  const ready = Boolean(title.trim() && description.trim()) && !sending
  const fields = {
    kind,
    setKind,
    title,
    setTitle,
    description,
    setDescription,
    includeSystemInfo,
    setIncludeSystemInfo,
  }
  return { ...fields, ready, sending, error, sent, send }
}

/** Bug reports and feature requests, opened as issues on Revio's GitHub repository. */
export function FeedbackSettings() {
  const form = useFeedbackForm()
  const [repo, setRepo] = useState<string | null>(null)
  useEffect(() => {
    globalThis.revio
      .getFeedbackRepo()
      .then(setRepo)
      .catch(() => setRepo(null))
  }, [])
  return (
    <div className="space-y-3 px-4 py-3">
      <SegmentedControl segments={KINDS} value={form.kind} onChange={form.setKind} className="w-fit" />
      <input
        className="input"
        placeholder="Title"
        aria-label="Title"
        value={form.title}
        onChange={(event) => form.setTitle(event.target.value)}
      />
      <textarea
        className="input min-h-28 resize-y font-sans"
        placeholder={DESCRIPTION_HINTS[form.kind]}
        aria-label="Description"
        value={form.description}
        onChange={(event) => form.setDescription(event.target.value)}
      />
      {form.kind === 'bug' && (
        <SystemInfoChoice include={form.includeSystemInfo} onChange={form.setIncludeSystemInfo} />
      )}
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={!form.ready} onClick={() => form.send()}>
          {SEND_LABELS[String(form.sending)]}
        </button>
        {form.sent !== null && <SentNote result={form.sent} />}
        {form.error !== null && <span className="text-[12px] text-danger">{form.error}</span>}
      </div>
      {repo !== null && (
        <div className="text-[12px] text-muted">Opens a public issue on github.com/{repo} as your GitHub account.</div>
      )}
    </div>
  )
}
