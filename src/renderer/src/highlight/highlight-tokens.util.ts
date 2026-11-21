import { createHighlighterCore, type HighlighterCore } from 'shiki/core'

import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

import { bundledLanguages, bundledLanguagesAlias } from 'shiki/langs'

const EXT: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  jsonc: 'jsonc',
  md: 'markdown',
  mdx: 'mdx',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  vue: 'vue',
  svelte: 'svelte',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  rb: 'ruby',
  php: 'php',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  toml: 'toml',
  tf: 'terraform',
  hcl: 'hcl',
  graphql: 'graphql',
  gql: 'graphql',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  xml: 'xml',
  prisma: 'prisma',
  proto: 'proto',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  lua: 'lua',
  scala: 'scala',
  ini: 'ini',
  env: 'dotenv',
  csv: 'csv',
}

const FILENAMES: Record<string, string> = { Dockerfile: 'docker', Makefile: 'make', '.gitignore': 'gitignore' }

const MAX_PATCH = 250_000

type Loader = () => Promise<unknown>

const loaders = {
  ...(bundledLanguagesAlias as Record<string, Loader>),
  ...(bundledLanguages as Record<string, Loader>),
}

const THEMES = { dark: 'github-dark-default', light: 'github-light-default' } as const

function tokenLines(core: HighlighterCore, code: string, lang: string): Tok[][] {
  return core
    .codeToTokens(code, { lang, themes: THEMES, defaultColor: false })
    .tokens.map((line) => line.map((token) => ({ text: token.content, style: token.htmlStyle })))
}

/** Owns one Shiki instance and the languages loaded into it. */
/** Loads a language's grammar into the highlighter; false when there is none or it fails to load. */
function loadLanguage(core: HighlighterCore, lang: string): Promise<boolean> {
  const loader = loaders[lang]
  if (!loader) {
    return Promise.resolve(false)
  }
  return core.loadLanguage(loader() as never).then(
    () => true,
    () => false,
  )
}

/** A colored span. `style` carries both theme colors as CSS variables (see styles.css `.tok`). */
export interface Tok {
  text: string
  style?: Record<string, string> | undefined
}

/** The parts of a diff row the tokenizer needs (structured-clone friendly). */
export interface TokenRow {
  kind: 'hunk' | 'ctx' | 'add' | 'del'
  text: string
}

export function languageFor(path: string): string | null {
  const name = path.slice(path.lastIndexOf('/') + 1)
  if (FILENAMES[name]) {
    return FILENAMES[name]
  }
  if (name.startsWith('Dockerfile')) {
    return 'docker'
  }
  let ext = ''
  if (name.includes('.')) {
    ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  }
  const lang = EXT[ext] ?? ext
  if (!(lang in loaders)) {
    return null
  }
  return lang
}

/** The Shiki language for a fence's info string (```ts, ```typescript, ```py…), or null when unknown. */
export function languageNamed(name: string): string | null {
  const key = name.trim().toLowerCase()
  if (!key) {
    return null
  }
  if (key in loaders) {
    return key
  }
  return languageFor(`file.${key}`)
}

export class TokenHighlighter {
  #core: Promise<HighlighterCore> | null = null
  readonly #languages = new Map<string, Promise<boolean>>()

  #highlighter() {
    // The JS regex engine avoids WebAssembly, which the app's CSP does not allow.
    this.#core ??= createHighlighterCore({
      themes: [import('shiki/themes/github-dark-default.mjs'), import('shiki/themes/github-light-default.mjs')],
      langs: [],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    })
    return this.#core
  }

  #ensureLanguage(core: HighlighterCore, lang: string) {
    let ready = this.#languages.get(lang)
    if (!ready) {
      ready = loadLanguage(core, lang)
      this.#languages.set(lang, ready)
    }
    return ready
  }

  /** Tokens per line of a code block, or null when the language is unknown or the code is too large. */
  async tokenizeCode(language: string, code: string): Promise<Tok[][] | null> {
    const lang = languageNamed(language)
    if (!lang || code.length > MAX_PATCH) {
      return null
    }
    const core = await this.#highlighter()
    if (!(await this.#ensureLanguage(core, lang))) {
      return null
    }
    try {
      return tokenLines(core, code, lang)
    } catch {
      return null
    }
  }

  /**
   * Tokens per row index, or null when the language is unknown or the diff is too large.
   * Each hunk's new side (context + added) and old side (context + removed) is tokenized as one
   * blob, so multi-line strings and comments color correctly within a hunk.
   */
  async tokenizeRows(path: string, rows: readonly TokenRow[], patchLength: number): Promise<Map<number, Tok[]> | null> {
    const lang = languageFor(path)
    if (!lang || patchLength > MAX_PATCH) {
      return null
    }
    const core = await this.#highlighter()
    if (!(await this.#ensureLanguage(core, lang))) {
      return null
    }

    const out = new Map<number, Tok[]>()
    const tokenize = (indices: number[], keep: (row: TokenRow) => boolean) => {
      const kept = (rowIndex: number) => {
        const row = rows[rowIndex]
        return row !== undefined && keep(row)
      }
      if (!indices.some(kept)) {
        return
      }
      try {
        const lines = tokenLines(core, indices.map((index) => rows[index]?.text).join('\n'), lang)
        for (const [position, rowIdx] of indices.entries()) {
          if (kept(rowIdx)) {
            out.set(rowIdx, lines[position] ?? [])
          }
        }
      } catch {
        /* leave these rows plain */
      }
    }

    let oldSide: number[] = []
    let newSide: number[] = []
    const flush = () => {
      tokenize(newSide, (row) => row.kind !== 'del')
      tokenize(oldSide, (row) => row.kind === 'del')
      oldSide = []
      newSide = []
    }
    for (const [rowIndex, row] of rows.entries()) {
      if (row.kind === 'hunk') {
        flush()
      }
      if (row.kind === 'del' || row.kind === 'ctx') {
        oldSide.push(rowIndex)
      }
      if (row.kind === 'add' || row.kind === 'ctx') {
        newSide.push(rowIndex)
      }
    }
    flush()
    return out
  }
}
