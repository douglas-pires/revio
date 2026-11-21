import { isValidElement, memo, type ReactNode, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './code-block.component.tsx'
import { MermaidBlock } from './mermaid-block.component.tsx'

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

const WEB_URL = /^https?:/u
const CODE_LANGUAGE = /\blanguage-(?<language>[\w+#.-]+)/u
const TRAILING_NEWLINE = /\n$/u

const open = (href?: string) => {
  if (href && WEB_URL.test(href)) {
    globalThis.revio.openExternal(href)
  }
}

/** An image source that is a URL; markdown can also hand over a Blob, which the app never shows. */
function keepString(src: unknown) {
  if (typeof src !== 'string') {
    return
  }
  return src
}

function Img({
  src,
  alt,
  width,
  height,
}: {
  src?: string | undefined
  alt?: string | undefined
  width?: string | number | undefined
  height?: string | number | undefined
}) {
  const [broken, setBroken] = useState(false)
  if (!src) {
    return null
  }
  // Images on private repos often need a GitHub session the app does not have; offer a link instead.
  if (broken) {
    return (
      <a
        href={src}
        onClick={(event) => {
          event.preventDefault()
          open(src)
        }}
        className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[12px] no-underline"
      >
        🖼 {alt || 'image'} ↗
      </a>
    )
  }
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError swaps a broken image for a link; it is not a user interaction.
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      onError={() => setBroken(true)}
      className="inline-block max-w-full rounded"
    />
  )
}

/** The file extension, used as the language of a ```suggestion block on that file. */
function readExtension(path: string | undefined) {
  if (!path?.includes('.')) {
    return
  }
  return path.slice(path.lastIndexOf('.') + 1)
}

/**
 * Fences arrive as <pre><code class="language-x">. Mermaid is drawn; other code is highlighted with a copy button.
 * A ```suggestion (a GitHub suggested change) is highlighted as the language of the file it comments on.
 */
function Pre({ children, codePath }: { children?: ReactNode; codePath?: string | undefined }) {
  if (!isValidElement<{ className?: string; children?: ReactNode }>(children)) {
    return <pre>{children}</pre>
  }
  const language = CODE_LANGUAGE.exec(children.props.className ?? '')?.groups?.language
  const code = String(children.props.children ?? '').replace(TRAILING_NEWLINE, '')
  if (language === 'mermaid') {
    return <MermaidBlock code={code} />
  }
  if (language === 'suggestion') {
    return <CodeBlock code={code} language={readExtension(codePath)} label="Suggested change" />
  }
  return <CodeBlock code={code} language={language} />
}

export const Markdown = memo(function MarkdownView({
  children,
  className = '',
  codePath,
}: {
  children: string
  className?: string
  /** The file this text comments on, for highlighting ```suggestion blocks. */
  codePath?: string | undefined
}) {
  return (
    <div className={`prose-revio ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          a: ({ href, children: label }) => (
            <a
              href={href}
              onClick={(event) => {
                event.preventDefault()
                open(href)
              }}
            >
              {label}
            </a>
          ),
          pre: ({ children: code }) => <Pre codePath={codePath}>{code}</Pre>,
          img: ({ src, alt, width, height }) => <Img src={keepString(src)} alt={alt} width={width} height={height} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})
