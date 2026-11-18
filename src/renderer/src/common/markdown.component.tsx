import { isValidElement, memo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { MermaidBlock } from './mermaid-block.component'
import { CodeBlock } from './code-block.component'

/**
 * GitHub-flavored markdown with the inline HTML people put in PR descriptions
 * (<details>, <summary>, <img width>, <p align>, <sub>…). Raw HTML is parsed, then
 * sanitized with GitHub's own allow-list, so scripts, styles and event handlers are stripped.
 */
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), 'alt', 'width', 'height', 'align'],
    details: ['open'],
    p: [...(defaultSchema.attributes?.p ?? []), 'align'],
    div: [...(defaultSchema.attributes?.div ?? []), 'align'],
  },
}

const open = (href?: string) => {
  if (href && /^https?:/.test(href)) void window.revio.openExternal(href)
}

function Img({ src, alt, width, height }: { src?: string; alt?: string; width?: string | number; height?: string | number }) {
  const [broken, setBroken] = useState(false)
  if (!src) return null
  // Images on private repos often need a GitHub session the app does not have; offer a link instead.
  if (broken)
    return (
      <a href={src} onClick={(e) => { e.preventDefault(); open(src) }} className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[12px] no-underline">
        🖼 {alt || 'image'} ↗
      </a>
    )
  return <img src={src} alt={alt} width={width} height={height} onError={() => setBroken(true)} className="inline-block max-w-full rounded" />
}

/** The file extension, used as the language of a ```suggestion block on that file. */
const extensionOf = (path?: string) => (path?.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : undefined)

/**
 * Fences arrive as <pre><code class="language-x">. Mermaid is drawn; other code is highlighted with a copy button.
 * A ```suggestion (a GitHub suggested change) is highlighted as the language of the file it comments on.
 */
function Pre({ children, codePath }: { children?: ReactNode; codePath?: string }) {
  if (!isValidElement<{ className?: string; children?: ReactNode }>(children)) return <pre>{children}</pre>
  const language = /\blanguage-([\w+#.-]+)/.exec(children.props.className ?? '')?.[1]
  const code = String(children.props.children ?? '').replace(/\n$/, '')
  if (language === 'mermaid') return <MermaidBlock code={code} />
  if (language === 'suggestion') return <CodeBlock code={code} language={extensionOf(codePath)} label="Suggested change" />
  return <CodeBlock code={code} language={language} />
}

export const Markdown = memo(function Markdown({ children, className = '', codePath }: {
  children: string
  className?: string
  /** The file this text comments on, for highlighting ```suggestion blocks. */
  codePath?: string
}) {
  return (
    <div className={`prose-revio ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                open(href)
              }}
            >
              {children}
            </a>
          ),
          pre: ({ children }) => <Pre codePath={codePath}>{children}</Pre>,
          img: ({ src, alt, width, height }) => <Img src={typeof src === 'string' ? src : undefined} alt={alt} width={width} height={height} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})
