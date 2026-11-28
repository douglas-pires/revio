import { useEffect, useState } from 'react'
import { CodeBlock } from './code-block.component.tsx'
import { type Permalink, sliceLines } from './permalink.util.ts'

/** What a permalink's card shows: nothing yet, the lines, or (missing file, no access) the plain link. */
type CardState = { kind: 'loading' } | { kind: 'shown'; code: string; cut: boolean } | { kind: 'failed' }

/** The file's extension, as the code's language. */
function readLanguage(path: string) {
  return path.slice(path.lastIndexOf('.') + 1)
}

/** The lines a permalink names, fetched from GitHub once the card shows. */
function usePermalinkLines(link: Permalink) {
  const [state, setState] = useState<CardState>({ kind: 'loading' })
  const { repo, ref, path, start, end } = link
  useEffect(() => {
    let live = true
    globalThis.revio
      .getFileContent({ repo, sha: ref, path })
      .then((text) => {
        const sliced = text === null ? null : sliceLines(text, { start, end })
        if (live) {
          setState(sliced ? { kind: 'shown', ...sliced } : { kind: 'failed' })
        }
      })
      .catch(() => live && setState({ kind: 'failed' }))
    return () => {
      live = false
    }
    // The link's fields, not the object, which markdown makes anew on each render.
  }, [repo, ref, path, start, end])
  return state
}

/** "L12" or "L12–L20". */
function describeLines(link: Permalink) {
  if (link.start === link.end) {
    return `L${link.start}`
  }
  return `L${link.start}–L${link.end}`
}

/** The heading of the card: where the lines are, and a link to them on GitHub. */
function CardLabel({ link, href, cut }: { link: Permalink; href: string; cut: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-mono" title={link.path}>
        {link.path} · {describeLines(link)}
        {cut && ' (first lines)'}
      </span>
      <span className="shrink-0 text-muted">{link.ref.slice(0, 7)}</span>
      <button type="button" className="shrink-0 text-accent" onClick={() => globalThis.revio.openExternal(href)}>
        GitHub ↗
      </button>
    </span>
  )
}

/** A GitHub permalink on a line of its own, shown as the code it points to, as GitHub does. */
export function PermalinkCard({ link, href }: { link: Permalink; href: string }) {
  const state = usePermalinkLines(link)
  if (state.kind === 'failed') {
    return (
      <p>
        <button type="button" className="text-accent underline" onClick={() => globalThis.revio.openExternal(href)}>
          {href}
        </button>
      </p>
    )
  }
  if (state.kind === 'loading') {
    return <div className="not-prose my-2 h-16 animate-pulse rounded-md border border-line bg-panel-2" />
  }
  return (
    <CodeBlock
      code={state.code}
      language={readLanguage(link.path)}
      firstLine={link.start}
      label={<CardLabel link={link} href={href} cut={state.cut} />}
    />
  )
}
