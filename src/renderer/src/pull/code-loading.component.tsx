import { Mascot } from '../common/mascot.component.tsx'
import { withPositions } from '../common/numbered-lines.util.ts'
import './code-loading.css'

/** The widths of the placeholder lines, as a share of the panel: an indented block of code. */
const LINES = [
  { indent: 0, width: 46 },
  { indent: 1, width: 62 },
  { indent: 2, width: 38 },
  { indent: 2, width: 54 },
  { indent: 1, width: 30 },
  { indent: 0, width: 12 },
  { indent: 0, width: 0 },
  { indent: 0, width: 50 },
  { indent: 1, width: 70 },
  { indent: 1, width: 44 },
  { indent: 0, width: 12 },
] as const

/** The indent per level, in the panel's monospace characters. */
const INDENT_CH = 2

/**
 * Shown in the code panel while a PR loads: the mascot reading faint lines of "code" with a light sweeping over them,
 * and what is loading.
 * It takes the panel's place without moving anything around it.
 */
export function CodeLoading({ label }: { label: string }) {
  return (
    <div
      data-code-loading={true}
      role="status"
      className="flex min-h-0 flex-1 flex-col items-center justify-center p-8"
    >
      <Mascot className="relative z-10 -mb-3 size-28" />
      <div className="code-loading w-full max-w-xl rounded-lg border border-line bg-panel px-5 py-4 font-mono">
        {withPositions(LINES).map(({ item: line, position }) => (
          <div key={position} className="flex h-5 items-center gap-3">
            <span className="w-5 shrink-0 text-right text-[11px] text-muted/50">{position}</span>
            <span
              className="code-loading-line h-2 rounded"
              // biome-ignore lint/style/noInlineStyles: each placeholder line has its own indent and length.
              style={{ marginLeft: `${line.indent * INDENT_CH}ch`, width: `${line.width}%` }}
            />
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12.5px] text-muted">{label}</p>
    </div>
  )
}
