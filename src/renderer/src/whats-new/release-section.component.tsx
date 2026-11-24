import type { ReleaseChange, ReleaseNotes } from '@shared/whats-new.types.ts'
import { countOf, joinClassNames } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })

function ChangeItem({ change }: { change: ReleaseChange }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden={true} className="text-muted">
        •
      </span>
      <span>
        {Boolean(change.breaking) && <span className="chip mr-1.5 bg-warn/20 text-warn">Breaking</span>}
        {Boolean(change.scope) && <span className="text-muted">{change.scope}: </span>}
        {change.text}
      </span>
    </li>
  )
}

function ChangeList({ title, tone, changes }: { title: string; tone: string; changes: readonly ReleaseChange[] }) {
  if (changes.length === 0) {
    return null
  }
  return (
    <div>
      <h3 className={joinClassNames('mb-1.5 text-[12px] font-semibold', tone)}>{title}</h3>
      <ul className="space-y-1">
        {changes.map((change) => (
          <ChangeItem key={`${change.scope}:${change.text}`} change={change} />
        ))}
      </ul>
    </div>
  )
}

/** Changes nobody using Revio notices, folded away. */
function OtherChanges({ changes }: { changes: readonly ReleaseChange[] }) {
  if (changes.length === 0) {
    return null
  }
  return (
    <details className="text-[12px] text-muted">
      <summary className="cursor-pointer">{countOf(changes.length, 'change', 'changes')} under the hood</summary>
      <ul className="mt-1.5 space-y-1">
        {changes.map((change) => (
          <ChangeItem key={`${change.scope}:${change.text}`} change={change} />
        ))}
      </ul>
    </details>
  )
}

/** One release: its version and date, what is new, what is fixed, and the rest folded away. */
export function ReleaseSection({ notes, isNew }: { notes: ReleaseNotes; isNew: boolean }) {
  return (
    <section
      aria-label={`Revio ${notes.version}`}
      className={joinClassNames('card space-y-4 p-5', isNew && 'border-accent/60')}
    >
      <header className="flex items-baseline gap-2.5">
        <h2 className="text-[16px] font-semibold">Revio {notes.version}</h2>
        {Boolean(isNew) && <span className="chip bg-accent/15 text-accent">New</span>}
        <span className="text-[12px] text-muted">{DATE_FORMAT.format(new Date(notes.publishedAt))}</span>
        <div className="flex-1" />
        <button
          type="button"
          className="btn btn-ghost py-0 text-[12px]"
          onClick={() => globalThis.revio.openExternal(notes.url)}
        >
          GitHub ↗
        </button>
      </header>
      {Boolean(notes.introduction) && <Markdown>{notes.introduction}</Markdown>}
      <ChangeList title="Added" tone="text-accent" changes={notes.features} />
      <ChangeList title="Fixed" tone="text-ok" changes={notes.fixes} />
      <OtherChanges changes={notes.others} />
    </section>
  )
}
