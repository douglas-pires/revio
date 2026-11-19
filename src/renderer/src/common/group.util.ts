/** Groups items into a Map by key, keeping insertion order. */
export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const list = groups.get(key)
    if (list) {
      list.push(item)
    } else {
      groups.set(key, [item])
    }
  }
  return groups
}

/** One shared empty array, so memoized children see an unchanged prop when they have nothing. */
export const EMPTY: readonly never[] = Object.freeze([])

/** The set with `item` added, or removed when it was there. */
export function toggledIn<T>(set: ReadonlySet<T>, item: T): Set<T> {
  const next = new Set(set)
  if (next.has(item)) {
    next.delete(item)
  } else {
    next.add(item)
  }
  return next
}

/** For lists where one item is open at a time: opens `id`, or closes it when it is the open one. */
export function toggledOpen<T>(open: T | null, id: T): T | null {
  if (open === id) {
    return null
  }
  return id
}
