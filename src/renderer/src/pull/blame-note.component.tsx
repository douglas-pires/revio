import type { BlameRange } from '@shared/history.types.ts'
import { ago } from '../common/format.util.ts'

/** "author, 3 weeks ago • message" after a line's code, shown while the row is hovered (GitLens style). Opens the commit. */
export function BlameNote({ range }: { range: BlameRange }) {
  const { commit } = range
  return (
    <a
      href={commit.url}
      // Out of the tab order: every line has one; the commit is also in the file's history panel.
      tabIndex={-1}
      title={`${commit.shortSha} · ${commit.author} · ${new Date(commit.date).toLocaleString()}\n${commit.headline}\n\nClick to open the commit on GitHub`}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        globalThis.revio.openExternal(commit.url)
      }}
      className="blame-note ml-8 max-w-full cursor-pointer truncate align-bottom font-sans whitespace-nowrap text-[11.5px] text-muted/70 italic no-underline select-none hover:text-fg hover:underline"
    >
      {commit.author}, {ago(commit.date)} ago • {commit.headline}
    </a>
  )
}
