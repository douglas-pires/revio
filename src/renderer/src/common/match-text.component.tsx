/** `text` with every case-insensitive occurrence of `query` marked. */
export function MatchText({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-warn/30 text-fg">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  )
}
