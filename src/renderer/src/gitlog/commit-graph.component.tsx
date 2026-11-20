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

/** The colour of a lane; colours repeat past the end of the list. */
const pickLaneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length]
/** The horizontal middle of a lane, where its line and dots sit. */
const findLaneCenter = (lane: number) => lane * LANE_PX + LANE_PX / 2

/** A merge's dot is hollow, so merges stand apart from the work they bring in. */
function pickDotFill(merge: boolean, color: number) {
  if (merge) {
    return 'var(--color-panel)'
  }
  return pickLaneColor(color)
}

/** One row's slice of the commit graph: the lines through it and the commit's dot (hollow for a merge). */
export function GraphCell({ row, width, merge }: { row: GraphRow; width: number; merge: boolean }) {
  return (
    <svg width={width} height={ROW_PX} className="shrink-0" aria-hidden="true">
      {row.top.map((edge) => (
        <line
          key={`t${edge.from}-${edge.to}`}
          x1={findLaneCenter(edge.from)}
          y1={0}
          x2={findLaneCenter(edge.to)}
          y2={MID}
          stroke={pickLaneColor(edge.color)}
          strokeWidth={1.5}
        />
      ))}
      {row.bottom.map((edge) => (
        <line
          key={`b${edge.from}-${edge.to}-${edge.color}`}
          x1={findLaneCenter(edge.from)}
          y1={MID}
          x2={findLaneCenter(edge.to)}
          y2={ROW_PX}
          stroke={pickLaneColor(edge.color)}
          strokeWidth={1.5}
        />
      ))}
      <circle
        cx={findLaneCenter(row.lane)}
        cy={MID}
        r={DOT_R}
        fill={pickDotFill(merge, row.color)}
        stroke={pickLaneColor(row.color)}
        strokeWidth={1.5}
      />
    </svg>
  )
}
