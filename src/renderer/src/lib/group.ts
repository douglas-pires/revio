/** Groups items into a Map by key, keeping insertion order. */
export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return groups
}

/** One shared empty array, so memoized children see an unchanged prop when they have nothing. */
export const EMPTY: readonly never[] = Object.freeze([])
