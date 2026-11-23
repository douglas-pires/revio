/** Lanes shown at most; wider histories are cut at the right. */
const MAX_LANES = 14

/** Height of a log row, which the graph's lines span. */
export const ROW_PX = 26
/** Width of one lane. */
export const LANE_PX = 12

/** Width of the graph column for rows this wide. */
export function measureGraphWidth(lanes: number) {
  return Math.min(Math.max(lanes, 1), MAX_LANES) * LANE_PX
}
