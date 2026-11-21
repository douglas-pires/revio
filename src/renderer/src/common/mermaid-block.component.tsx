import { useEffect, useId, useRef, useState } from 'react'
import { joinClassNames, readErrorMessage } from './format.util.ts'
import { onActivateKey } from './keyboard.util.ts'

type MermaidApi = typeof import('mermaid')['default']
type MermaidTheme = 'dark' | 'default'

const WEB_URL = /^https?:/u
const NOT_ID_CHARACTERS = /[^a-zA-Z0-9]/gu

let loader: Promise<MermaidApi> | null = null
let configuredTheme: string | null = null

/** Mermaid is large, so it is loaded the first time a diagram is on screen. */
async function loadMermaid(theme: MermaidTheme) {
  loader ??= import('mermaid').then((module) => module.default)
  const mermaid = await loader
  if (configuredTheme !== theme) {
    // strict: no click handlers or HTML labels from the diagram source; output SVG is sanitized. Links in the
    // diagram still render; the block's click handler opens them in the browser.
    // suppressErrorRendering: on a parse error Mermaid would otherwise draw its own full-page "Syntax error" graphic
    // into <body>, outside the app; the block shows its own note instead.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
      fontFamily: 'inherit',
      suppressErrorRendering: true,
    })
    configuredTheme = theme
  }
  return mermaid
}

const isDarkPreferred = () => !globalThis.matchMedia('(prefers-color-scheme: light)').matches

/** Whether the app is in dark mode, following the system as it changes. */
function usePrefersDark() {
  const [dark, setDark] = useState(isDarkPreferred)
  useEffect(() => {
    const colorSchemeQuery = globalThis.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setDark(isDarkPreferred())
    colorSchemeQuery.addEventListener('change', onChange)
    return () => colorSchemeQuery.removeEventListener('change', onChange)
  }, [])
  return dark
}

/** The diagram drawn as SVG in the current theme, or why it could not be drawn. */
function useMermaidSvg(code: string) {
  const id = `mmd-${useId().replace(NOT_ID_CHARACTERS, '')}`
  const dark = usePrefersDark()
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let theme: MermaidTheme = 'default'
    if (dark) {
      theme = 'dark'
    }
    setError(null)
    loadMermaid(theme)
      .then((mermaid) => mermaid.render(`${id}-${theme}`, code))
      .then((drawn) => live && setSvg(drawn.svg))
      .catch((failure: unknown) => {
        // Mermaid renders into a temporary element in <body> (`d` + the render id); drop it if a failure left it there.
        document.querySelector(`#d${CSS.escape(`${id}-${theme}`)}`)?.remove()
        if (live) {
          setError(readErrorMessage(failure))
        }
      })
    return () => {
      live = false
    }
  }, [code, dark, id])
  return { svg, error }
}

/**
 * Mermaid sizes the SVG as width:100% with max-width = its natural width; zoomed shows it at natural size.
 * The viewBox holds the drawn size, since not every diagram type sets an inline max-width.
 */
function resizeDiagram(element: SVGSVGElement, zoomed: boolean) {
  const drawnWidth = element.viewBox?.baseVal?.width
  let natural = element.style.maxWidth || '100%'
  if (drawnWidth) {
    natural = `${Math.round(drawnWidth)}px`
  }
  if (zoomed) {
    element.style.width = natural
    element.style.maxWidth = 'none'
  } else {
    element.style.width = '100%'
    element.style.maxWidth = natural
  }
}

/** Diagrams can carry links (`click A "https://…"`). Opens one in the browser, never in the app window. */
function openDiagramLink(target: EventTarget) {
  const link = (target as Element).closest('a')
  if (!link) {
    return false
  }
  const href = link.getAttribute('href') ?? link.getAttribute('xlink:href')
  if (href && WEB_URL.test(href)) {
    globalThis.revio.openExternal(href)
  }
  return true
}

/** The drawn diagram; a click zooms between fitting the column and natural size. */
function Diagram({ svg }: { svg: string }) {
  const [zoomed, setZoomed] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = box.current?.querySelector('svg')
    if (element) {
      resizeDiagram(element, zoomed)
    }
  }, [zoomed])
  const toggleZoom = () => setZoomed(!zoomed)
  let title = 'Click to zoom'
  if (zoomed) {
    title = 'Click to fit'
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: the diagram can hold links, and a <button> cannot hold them.
    <div
      ref={box}
      role="button"
      tabIndex={0}
      title={title}
      onClick={(event) => {
        if (openDiagramLink(event.target)) {
          event.preventDefault()
          return
        }
        toggleZoom()
      }}
      onKeyDown={onActivateKey(toggleZoom)}
      className={joinClassNames(
        'flex overflow-x-auto [&_svg]:h-auto [&_svg]:shrink-0',
        zoomed && 'cursor-zoom-out justify-start',
        !zoomed && 'cursor-zoom-in justify-center',
      )}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid in strict mode returns sanitized SVG.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export function MermaidBlock({ code }: { code: string }) {
  const { svg, error } = useMermaidSvg(code)
  const [showSource, setShowSource] = useState(false)

  if (error) {
    return (
      <div className="not-prose my-3">
        <pre className="overflow-auto rounded-md bg-panel-2 p-3 font-mono text-[12px]">{code}</pre>
        <p className="mt-1 text-[11.5px] text-warn">Could not draw this Mermaid diagram: {error.split('\n')[0]}</p>
      </div>
    )
  }

  return (
    <div className="not-prose group/mmd relative my-3 rounded-md border border-line bg-panel-2 p-3">
      <button
        type="button"
        className="btn btn-ghost absolute top-1.5 right-1.5 py-0 text-[11px] opacity-0 transition group-hover/mmd:opacity-100"
        onClick={() => setShowSource(!showSource)}
      >
        {Boolean(showSource) && 'Diagram'}
        {!showSource && 'Source'}
      </button>
      {Boolean(showSource) && <pre className="selectable overflow-auto font-mono text-[12px]">{code}</pre>}
      {/* A new drawing (after a theme change) is a new element to size, so it remounts. */}
      {!showSource && svg !== null && <Diagram key={svg} svg={svg} />}
      {!showSource && svg === null && <div className="py-6 text-center text-[12px] text-muted">Drawing diagram…</div>}
    </div>
  )
}
