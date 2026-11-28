import type { StatsTeam } from '@shared/stats.types.ts'
import { useEffect, useRef, useState } from 'react'

/** A team's key: "org/slug". */
const keyOf = (team: StatsTeam) => `${team.org}/${team.slug}`

/** The picked teams on the button: one name, or the first and how many more. */
function describePicked(picked: StatsTeam[]) {
  if (picked.length === 1) {
    return picked[0]!.name
  }
  return `${picked[0]?.name ?? 'No team'} +${picked.length - 1}`
}

/** Closes the list on a click outside it or Escape. */
function useCloseOutside(open: boolean, close: () => void) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) {
      return
    }
    const closeOnOutside = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) {
        close()
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && close()
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, close])
  return box
}

/** Which of your teams the stats cover: one or several, combined. At least one stays picked. */
export function TeamPicker(props: { teams: StatsTeam[]; picked: StatsTeam[]; onChange: (teams: StatsTeam[]) => void }) {
  const [open, setOpen] = useState(false)
  const box = useCloseOutside(open, () => setOpen(false))
  const pickedKeys = new Set(props.picked.map(keyOf))
  const toggle = (team: StatsTeam) => {
    const next = pickedKeys.has(keyOf(team))
      ? props.picked.filter((picked) => keyOf(picked) !== keyOf(team))
      : [...props.picked, team]
    if (next.length > 0) {
      props.onChange(next)
    }
  }
  return (
    <div ref={box} className="relative">
      <button type="button" className="input w-56 py-0.5 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        {describePicked(props.picked)} <span className="float-right text-muted">▾</span>
      </button>
      {open && (
        <div className="card absolute top-full left-0 z-20 mt-1 max-h-80 w-72 overflow-y-auto p-1 shadow-lg">
          {props.teams.map((team) => (
            <label
              key={keyOf(team)}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12.5px] hover:bg-hover"
            >
              <input
                type="checkbox"
                className="accent-[var(--color-accent)]"
                checked={pickedKeys.has(keyOf(team))}
                onChange={() => toggle(team)}
              />
              <span className="truncate">{team.name}</span>
              <span className="ml-auto text-muted">{team.org}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
