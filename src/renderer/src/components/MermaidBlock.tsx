import { useEffect, useId, useRef, useState } from 'react'
import { cx } from '../lib/format'

type MermaidApi = (typeof import('mermaid'))['default']

let loader: Promise<MermaidApi> | null = null
let configuredTheme: string | null = null

/** Mermaid is large, so it is loaded the first time a diagram is on screen. */
async function mermaidFor(theme: 'dark' | 'default') {
  loader ??= import('mermaid').then((m) => m.default)
  const mermaid = await loader
  if (configuredTheme !== theme) {
    // strict: no click handlers or HTML labels from the diagram source; output SVG is sanitized.
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme, fontFamily: 'inherit' })
    configuredTheme = theme
  }
  return mermaid
}

const prefersDark = () => !window.matchMedia('(prefers-color-scheme: light)').matches

export function MermaidBlock({ code }: { code: string }) {
  const id = `mmd-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dark, setDark] = useState(prefersDark)
  const [showSource, setShowSource] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // Mermaid sizes the SVG as width:100% with max-width = natural width. Zoomed shows it at natural size.
  useEffect(() => {
    const el = box.current?.querySelector('svg')
    if (!el) return
    // The viewBox holds the diagram's drawn size; not every diagram type sets an inline max-width.
    const vb = el.viewBox?.baseVal?.width
    const natural = vb ? `${Math.round(vb)}px` : el.style.maxWidth || '100%'
    el.style.width = zoomed ? natural : '100%'
    el.style.maxWidth = zoomed ? 'none' : natural
  }, [zoomed, svg, showSource])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setDark(prefersDark())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    let live = true
    setError(null)
    mermaidFor(dark ? 'dark' : 'default')
      .then((m) => m.render(`${id}-${dark ? 'd' : 'l'}`, code))
      .then(({ svg }) => live && setSvg(svg))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [code, dark, id])

  if (error)
    return (
      <div className="not-prose my-3">
        <pre className="overflow-auto rounded-md bg-panel-2 p-3 font-mono text-[12px]">{code}</pre>
        <p className="mt-1 text-[11.5px] text-warn">Could not draw this Mermaid diagram: {error.split('\n')[0]}</p>
      </div>
    )

  return (
    <div className="not-prose group/mmd relative my-3 rounded-md border border-line bg-panel-2 p-3">
      <button
        className="btn btn-ghost absolute top-1.5 right-1.5 py-0 text-[11px] opacity-0 transition group-hover/mmd:opacity-100"
        onClick={() => setShowSource(!showSource)}
      >
        {showSource ? 'Diagram' : 'Source'}
      </button>
      {showSource ? (
        <pre className="selectable overflow-auto font-mono text-[12px]">{code}</pre>
      ) : svg ? (
        // Mermaid output in strict mode is sanitized SVG.
        <div
          ref={box}
          title={zoomed ? 'Click to fit' : 'Click to zoom'}
          onClick={() => setZoomed(!zoomed)}
          className={cx('flex overflow-x-auto [&_svg]:h-auto [&_svg]:shrink-0', zoomed ? 'cursor-zoom-out justify-start' : 'cursor-zoom-in justify-center')}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="py-6 text-center text-[12px] text-muted">Drawing diagram…</div>
      )}
    </div>
  )
}
