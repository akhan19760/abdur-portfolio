import { useCallback, useState } from "react"

type DiscoveriesOptions = {
  /** Start with everything found (e.g. on touch, where there's no light). */
  initiallyFound?: boolean
}

/**
 * Tracks which of a set of hidden things the visitor has found (About's
 * fragments, stars, log lines and satellites).
 *
 * Finding is one-way: nothing un-finds an item. Unknown ids are ignored so
 * stale ids can't push the count past `total`.
 */
export function useDiscoveries(
  ids: readonly string[],
  { initiallyFound = false }: DiscoveriesOptions = {}
) {
  const [found, setFound] = useState<ReadonlySet<string>>(() =>
    initiallyFound ? new Set(ids) : new Set()
  )

  const markFound = useCallback(
    (id: string) => {
      if (!ids.includes(id)) return
      setFound((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        return next
      })
    },
    [ids]
  )

  const markAll = useCallback(() => setFound(new Set(ids)), [ids])

  const isFound = useCallback((id: string) => found.has(id), [found])

  return {
    found,
    markFound,
    markAll,
    isFound,
    foundCount: found.size,
    total: ids.length,
    allFound: ids.length > 0 && found.size === ids.length,
  }
}
