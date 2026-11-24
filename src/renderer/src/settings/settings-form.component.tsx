/** A card of settings, one per row. */
export function Group({ children }: { children: React.ReactNode }) {
  return <div className="card divide-y divide-line">{children}</div>
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="mb-1.5 font-medium">{label}</div>
      {children}
      {Boolean(hint) && <div className="mt-1.5 text-[12px] text-muted">{hint}</div>}
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between px-4 py-3">
      <span>{label}</span>
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-accent)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

export function Num(props: {
  label: string
  unit: string
  value: number
  min: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center justify-between px-4 py-3">
      <span>{props.label}</span>
      <span className="flex items-center gap-2 text-muted">
        <input
          type="number"
          min={props.min}
          className="input w-20 text-right"
          defaultValue={props.value}
          onBlur={(event) => {
            const parsed = Number(event.target.value)
            if (Number.isFinite(parsed) && parsed >= props.min && parsed !== props.value) {
              props.onChange(parsed)
            }
          }}
        />
        {props.unit}
      </span>
    </label>
  )
}
