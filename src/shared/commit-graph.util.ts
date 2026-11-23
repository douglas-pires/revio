/** A column of the graph, waiting for the next commit of its line of history. */
interface Lane {
  awaitedHash: string
  color: number
}

/** The commit's dot: the lane it sits on and that lane's colour. */
interface Dot {
  lane: number
  color: number
}

/** The lanes below a commit, before ended lanes close up (null where a lane ended). */
interface LanesBelow {
  lanes: (Lane | null)[]
  /** Positions of the lanes opened for the commit's other parents. */
  openedForParents: number[]
  nextColor: number
}

/** The lane waiting for the commit, or a new lane at the right when none was (a branch tip). */
function placeDot(lanes: readonly Lane[], hash: string, nextColor: number) {
  const waiting = lanes.findIndex((lane) => lane.awaitedHash === hash)
  if (waiting >= 0) {
    return { lanes, dot: { lane: waiting, color: lanes[waiting]?.color ?? 0 }, nextColor }
  }
  const opened = { awaitedHash: hash, color: nextColor }
  return { lanes: [...lanes, opened], dot: { lane: lanes.length, color: nextColor }, nextColor: nextColor + 1 }
}

/** Every lane waiting for this commit ends at its dot, except the dot's own, which carries on to the first parent. */
function continueLanes(commit: GraphCommit, lanes: readonly Lane[], dot: Dot): (Lane | null)[] {
  const [firstParent] = commit.parents
  return lanes.map((lane, position) => {
    if (lane.awaitedHash !== commit.hash) {
      return lane
    }
    if (position === dot.lane && firstParent) {
      return { awaitedHash: firstParent, color: dot.color }
    }
    return null
  })
}

/** The lanes below the commit: continued ones, plus a new lane for each other parent no lane waits for yet. */
function openLanesBelow(commit: GraphCommit, lanes: readonly Lane[], dot: Dot, nextColor: number): LanesBelow {
  const below = continueLanes(commit, lanes, dot)
  const openedForParents: number[] = []
  let color = nextColor
  for (const parent of commit.parents.slice(1)) {
    if (!below.some((lane) => lane?.awaitedHash === parent)) {
      below.push({ awaitedHash: parent, color })
      color += 1
      openedForParents.push(below.length - 1)
    }
  }
  return { lanes: below, openedForParents, nextColor: color }
}

/** Drops the lanes that ended, remembering where each remaining lane moved to. */
function closeEndedLanes(lanes: readonly (Lane | null)[]) {
  const movedTo = new Map<number, number>()
  const remaining: Lane[] = []
  lanes.forEach((lane, position) => {
    if (lane) {
      movedTo.set(position, remaining.length)
      remaining.push(lane)
    }
  })
  return { movedTo, remaining }
}

/** Upper half of the row: each lane runs down to the middle, and lanes waiting for this commit bend to its dot. */
function drawUpperHalf(commit: GraphCommit, lanes: readonly Lane[], dot: Dot): GraphEdge[] {
  return lanes.map((lane, position) => {
    let to = position
    if (lane.awaitedHash === commit.hash) {
      to = dot.lane
    }
    return { from: position, to, color: lane.color }
  })
}

/** Lower half of the row: lanes passing by, the dot's own lane, and lines from the dot to the lanes of its parents. */
function drawLowerHalf(commit: GraphCommit, dot: Dot, below: LanesBelow, movedTo: ReadonlyMap<number, number>) {
  const mergedParents = new Set(commit.parents.slice(1))
  const edges: GraphEdge[] = []
  below.lanes.forEach((lane, position) => {
    const to = movedTo.get(position)
    if (!lane || to === undefined) {
      return
    }
    if (position === dot.lane || below.openedForParents.includes(position)) {
      // The dot's own lane, or a lane opened for one of its parents: the line starts at the dot.
      edges.push({ from: dot.lane, to, color: lane.color })
      return
    }
    edges.push({ from: position, to, color: lane.color })
    if (mergedParents.has(lane.awaitedHash)) {
      // A merge of a line of history that already has a lane: join it from the dot.
      edges.push({ from: dot.lane, to, color: lane.color })
    }
  })
  return edges
}

/** A line in one row of the graph, from a lane at the top or middle of the row to a lane at the middle or bottom. */
interface GraphEdge {
  from: number
  to: number
  /** The lane the line belongs to, for its colour. */
  color: number
}

/** What the graph needs of a commit: its hash and its parents, first parent first. */
export interface GraphCommit {
  hash: string
  parents: readonly string[]
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
  let above: { lanes: Lane[]; nextColor: number } = { lanes: [], nextColor: 0 }
  const rows: GraphRow[] = []
  for (const commit of commits) {
    const placed = placeDot(above.lanes, commit.hash, above.nextColor)
    const below = openLanesBelow(commit, placed.lanes, placed.dot, placed.nextColor)
    const { movedTo, remaining } = closeEndedLanes(below.lanes)
    rows.push({
      ...placed.dot,
      top: drawUpperHalf(commit, placed.lanes, placed.dot),
      bottom: drawLowerHalf(commit, placed.dot, below, movedTo),
      width: Math.max(placed.lanes.length, below.lanes.length, 1),
    })
    above = { lanes: remaining, nextColor: below.nextColor }
  }
  return rows
}
