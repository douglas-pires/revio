import type { GraphRow } from '@shared/commit-graph.util.ts'
import { LANE_PX, ROW_PX } from './graph-geometry.util.ts'

const DOT_R = 3.5
const MID = ROW_PX / 2

/** Lane colours, theme colours first, so lines read in light and dark. */
const LANE_COLORS = [
  'var(--color-accent)',
  'var(--color-ok)',
  'var(--color-warn)',
  'var(--color-danger)',
  'var(--color-focus)',
  'rgb(163 113 247)',
  'rgb(57 197 207)',
  'var(--color-muted)',
]

const colorOf = (n: number) => LANE_COLORS[n % LANE_COLORS.length]
const xOf = (lane: number) => lane * LANE_PX + LANE_PX / 2

/** A merge's dot is hollow, so merges stand apart from the work they bring in. */
function dotFill(merge: boolean, color: number) {
  if (merge) {
    return 'var(--color-panel)'
  }
  return colorOf(color)
}

/** One row's slice of the commit graph: the lines through it and the commit's dot (hollow for a merge). */
export function GraphCell({ row, width, merge }: { row: GraphRow; width: number; merge: boolean }) {
  return (
    <svg width={width} height={ROW_PX} className="shrink-0" aria-hidden="true">
      {row.top.map((e) => (
        <line
          key={`t${e.from}-${e.to}`}
          x1={xOf(e.from)}
          y1={0}
          x2={xOf(e.to)}
          y2={MID}
          stroke={colorOf(e.color)}
          strokeWidth={1.5}
        />
      ))}
      {row.bottom.map((e) => (
        <line
          key={`b${e.from}-${e.to}-${e.color}`}
          x1={xOf(e.from)}
          y1={MID}
          x2={xOf(e.to)}
          y2={ROW_PX}
          stroke={colorOf(e.color)}
          strokeWidth={1.5}
        />
      ))}
      <circle
        cx={xOf(row.lane)}
        cy={MID}
        r={DOT_R}
        fill={dotFill(merge, row.color)}
        stroke={colorOf(row.color)}
        strokeWidth={1.5}
      />
    </svg>
  )
}
