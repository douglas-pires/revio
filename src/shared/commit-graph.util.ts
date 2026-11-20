interface Lane {
  /** The commit this lane waits for. */
  hash: string
  color: number
}

/** The lanes after a commit: its own lane carries on to its first parent, other parents may open lanes. */
interface Step {
  /** Lanes below the dot, before gaps close (null where a lane ended). */
  after: (Lane | null)[]
  /** Positions in `after` of lanes opened for the commit's other parents. */
  opened: number[]
  nextColor: number
}

/** Every lane waiting for this commit ends at its dot; the dot's lane carries on to the first parent. */
function stepPast(
  c: GraphCommit,
  lanes: readonly Lane[],
  at: { lane: number; color: number; nextColor: number },
): Step {
  const { lane, color, nextColor } = at
  const after: (Lane | null)[] = lanes.map((l, i) => {
    if (l.hash !== c.hash) {
      return l
    }
    const [first] = c.parents
    if (i === lane && first) {
      return { hash: first, color }
    }
    return null
  })
  const opened: number[] = []
  let next = nextColor
  for (const p of c.parents.slice(1)) {
    if (!after.some((l) => l?.hash === p)) {
      after.push({ hash: p, color: next })
      next += 1
      opened.push(after.length - 1)
    }
  }
  return { after, opened, nextColor: next }
}

/** Where each surviving lane lands once the gaps close. */
function closeGaps(after: readonly (Lane | null)[]) {
  const moved = new Map<number, number>()
  const lanes: Lane[] = []
  after.forEach((l, i) => {
    if (l) {
      moved.set(i, lanes.length)
      lanes.push(l)
    }
  })
  return { moved, lanes }
}

/** The lane a top-half line ends at: the dot's, for every lane that waited for this commit. */
function topTarget(l: Lane, i: number, c: GraphCommit, lane: number) {
  if (l.hash === c.hash) {
    return lane
  }
  return i
}

/** Bottom-half lines: lanes passing by, the dot's own lane, and lines from the dot to the lanes of its parents. */
function bottomEdges(c: GraphCommit, lane: number, step: Step, moved: ReadonlyMap<number, number>): GraphEdge[] {
  const otherParents = new Set(c.parents.slice(1))
  const edges: GraphEdge[] = []
  step.after.forEach((l, i) => {
    const to = moved.get(i)
    if (!l || to === undefined) {
      return
    }
    if (i === lane || step.opened.includes(i)) {
      // The dot's own lane, or a lane opened for one of its parents: the line starts at the dot.
      edges.push({ from: lane, to, color: l.color })
      return
    }
    edges.push({ from: i, to, color: l.color })
    if (otherParents.has(l.hash)) {
      // A merge of a line of history that already has a lane: join it from the dot.
      edges.push({ from: lane, to, color: l.color })
    }
  })
  return edges
}

/** What the graph needs of a commit: its hash and its parents, first parent first. */
export interface GraphCommit {
  hash: string
  parents: readonly string[]
}

/** A line in one row of the graph, from a lane at the top or middle of the row to a lane at the middle or bottom. */
export interface GraphEdge {
  from: number
  to: number
  /** The lane the line belongs to, for its colour. */
  color: number
}

/** How to draw one commit's row: the dot's lane, and the lines through the row's top and bottom halves. */
export interface GraphRow {
  lane: number
  /** The dot's colour. */
  color: number
  /** Top half: lines from each lane at the top edge to the middle. */
  top: GraphEdge[]
  /** Bottom half: lines from the middle to each lane at the bottom edge. */
  bottom: GraphEdge[]
  /** Lanes in use at the widest point of the row, to size it. */
  width: number
}

/**
 * Lays out the commit graph the way IDE logs do: one lane per line of history, newest commit first. Each commit sits
 * on the lane that waited for it (the leftmost, when several did), its first parent continues that lane, and each
 * other parent gets a lane of its own unless one already waits for it. Lanes that end close up, so the graph stays
 * as narrow as the branches alive at each row.
 */
export function layoutGraph(commits: readonly GraphCommit[]): GraphRow[] {
  let lanes: Lane[] = []
  let nextColor = 0
  const rows: GraphRow[] = []
  for (const c of commits) {
    let lane = lanes.findIndex((l) => l.hash === c.hash)
    if (lane < 0) {
      lanes = [...lanes, { hash: c.hash, color: nextColor }]
      nextColor += 1
      lane = lanes.length - 1
    }
    const color = lanes[lane]?.color ?? 0
    const step = stepPast(c, lanes, { lane, color, nextColor })
    ;({ nextColor } = step)
    const { moved, lanes: below } = closeGaps(step.after)
    rows.push({
      lane,
      color,
      top: lanes.map((l, i) => ({ from: i, to: topTarget(l, i, c, lane), color: l.color })),
      bottom: bottomEdges(c, lane, step, moved),
      width: Math.max(lanes.length, step.after.length, 1),
    })
    lanes = below
  }
  return rows
}
