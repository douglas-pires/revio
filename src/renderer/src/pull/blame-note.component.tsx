import type { BlameRange } from '@shared/history.types'
import { ago } from '../common/format.util'

/** "author, 3 weeks ago • message" after a line's code, shown while the row is hovered (GitLens style). Opens the commit. */
export function BlameNote({ range }: { range: BlameRange }) {
  const c = range.commit
  return (
    <span
      role="link"
      tabIndex={-1}
      title={`${c.shortSha} · ${c.author} · ${new Date(c.date).toLocaleString()}\n${c.headline}\n\nClick to open the commit on GitHub`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => void window.revio.openExternal(c.url)}
      className="blame-note ml-8 max-w-full cursor-pointer truncate align-bottom font-sans whitespace-nowrap text-[11.5px] text-muted/70 italic select-none hover:text-fg hover:underline"
    >
      {c.author}, {ago(c.date)} ago • {c.headline}
    </span>
  )
}
