import { useState } from 'react'
import { formatWeek } from './stats-format.util.ts'

/** Chart size in viewBox units; it scales to the card's width. */
const WIDTH = 640
const HEIGHT = 140
const BASELINE = 120
const TOP = 14
/** Room on the left for the scale's label. */
const LEFT = 40
const BAR_GAP = 2
const CORNER = 4

/** A bar from the baseline up to `top`, its top corners rounded. */
function buildBarPath(left: number, width: number, top: number) {
  const radius = Math.min(CORNER, width / 2, BASELINE - top)
  const right = left + width
  return `M${left},${BASELINE}V${top + radius}Q${left},${top} ${left + radius},${top}H${right - radius}Q${right},${top} ${right},${top + radius}V${BASELINE}Z`
}

/** One measure per week as bars, with the value of the week under the pointer. */
export function WeekBars(props: {
  title: string
  weeks: { week: string; value: number | null }[]
  format: (value: number | null) => string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const highest = Math.max(1, ...props.weeks.map((week) => week.value ?? 0))
  const slot = (WIDTH - LEFT) / Math.max(1, props.weeks.length)
  const shown = hovered === null ? null : props.weeks[hovered]
  return (
    <figure className="card flex flex-col gap-2 p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{props.title}</span>
        <span className="text-[12px] text-muted">
          {shown ? `Week of ${formatWeek(shown.week)}: ${props.format(shown.value)}` : 'Hover a week'}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={props.title}>
        <line x1={LEFT} x2={WIDTH} y1={TOP} y2={TOP} className="stroke-line" strokeWidth={1} strokeDasharray="3 3" />
        <text x={0} y={TOP + 4} className="fill-muted text-[10px]">
          {props.format(highest)}
        </text>
        <line x1={LEFT} x2={WIDTH} y1={BASELINE} y2={BASELINE} className="stroke-line" strokeWidth={1} />
        <text x={0} y={BASELINE + 4} className="fill-muted text-[10px]">
          0
        </text>
        {props.weeks.map((week, index) => {
          const value = week.value ?? 0
          const top = BASELINE - ((BASELINE - TOP) * value) / highest
          const left = LEFT + index * slot + BAR_GAP
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: the hover only previews the value the table also lists
            <g key={week.week} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
              <rect x={LEFT + index * slot} y={0} width={slot} height={HEIGHT} fill="transparent" />
              {value > 0 && (
                <path
                  d={buildBarPath(left, slot - 2 * BAR_GAP, top)}
                  className={hovered === index ? 'fill-accent' : 'fill-accent/70'}
                />
              )}
              {(index % 2 === 0 || props.weeks.length <= 8) && (
                <text
                  x={LEFT + index * slot + slot / 2}
                  y={HEIGHT - 4}
                  textAnchor="middle"
                  className="fill-muted text-[10px]"
                >
                  {formatWeek(week.week)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
