import { joinClassNames } from './format.util.ts'
import './mascot.css'

/**
 * Revio's little reviewer: a round creature with an antenna, sweeping a magnifying glass from side to side while its
 * eyes follow it, bobbing and blinking now and then. Drawn and animated in CSS (mascot.css); it
 * holds still when the system asks for reduced motion.
 */
export function Mascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 104" className={joinClassNames('mascot', className)} aria-hidden={true}>
      <ellipse className="mascot-shadow" cx="60" cy="98" rx="26" ry="4" />
      <g className="mascot-body">
        <g className="mascot-antenna">
          <line x1="60" y1="24" x2="60" y2="10" />
          <circle cx="60" cy="8" r="4.5" />
        </g>
        <rect x="28" y="22" width="64" height="62" rx="28" className="mascot-skin" />
        <ellipse cx="60" cy="66" rx="20" ry="12" className="mascot-belly" />
        <g className="mascot-eyes">
          <ellipse cx="47" cy="48" rx="8" ry="9" className="mascot-eye" />
          <ellipse cx="73" cy="48" rx="8" ry="9" className="mascot-eye" />
          <g className="mascot-pupils">
            <circle cx="47" cy="50" r="4" />
            <circle cx="73" cy="50" r="4" />
            <circle cx="45.5" cy="48.5" r="1.3" className="mascot-glint" />
            <circle cx="71.5" cy="48.5" r="1.3" className="mascot-glint" />
          </g>
        </g>
        <circle cx="38" cy="61" r="4" className="mascot-cheek" />
        <circle cx="82" cy="61" r="4" className="mascot-cheek" />
        <path d="M54 63 Q60 68 66 63" className="mascot-mouth" />
        <g className="mascot-glass">
          <line x1="78" y1="88" x2="88" y2="98" className="mascot-handle" />
          <circle cx="72" cy="82" r="10" className="mascot-lens" />
          <path d="M66 78 Q69 74 74 74" className="mascot-shine" />
        </g>
      </g>
    </svg>
  )
}
