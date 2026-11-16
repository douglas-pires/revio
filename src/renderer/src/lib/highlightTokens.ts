import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { bundledLanguages, bundledLanguagesAlias } from 'shiki/langs'

/** A colored span. `style` carries both theme colors as CSS variables (see styles.css `.tok`). */
export interface Tok {
  text: string
  style?: Record<string, string>
}

/** The parts of a diff row the tokenizer needs (structured-clone friendly). */
export interface TokenRow {
  kind: 'hunk' | 'ctx' | 'add' | 'del'
  text: string
}

const EXT: Record<string, string> = {
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'tsx', js: 'javascript', mjs: 'javascript',
  cjs: 'javascript', jsx: 'jsx', json: 'json', jsonc: 'jsonc', md: 'markdown', mdx: 'mdx', css: 'css',
  scss: 'scss', less: 'less', html: 'html', vue: 'vue', svelte: 'svelte', py: 'python', go: 'go', rs: 'rust',
  java: 'java', kt: 'kotlin', kts: 'kotlin', rb: 'ruby', php: 'php', sh: 'shellscript', bash: 'shellscript',
  zsh: 'shellscript', yml: 'yaml', yaml: 'yaml', sql: 'sql', toml: 'toml', tf: 'terraform', hcl: 'hcl',
  graphql: 'graphql', gql: 'graphql', swift: 'swift', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
  xml: 'xml', prisma: 'prisma', proto: 'proto', dart: 'dart', ex: 'elixir', exs: 'elixir', lua: 'lua',
  scala: 'scala', ini: 'ini', env: 'dotenv', csv: 'csv',
}
const FILENAMES: Record<string, string> = { Dockerfile: 'docker', Makefile: 'make', '.gitignore': 'gitignore' }
const MAX_PATCH = 250_000

type Loader = () => Promise<unknown>
const loaders = { ...(bundledLanguagesAlias as Record<string, Loader>), ...(bundledLanguages as Record<string, Loader>) }

export function languageFor(path: string): string | null {
  const name = path.slice(path.lastIndexOf('/') + 1)
  if (FILENAMES[name]) return FILENAMES[name]
  if (name.startsWith('Dockerfile')) return 'docker'
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  const lang = EXT[ext] ?? ext
  return lang in loaders ? lang : null
}

/** Owns one Shiki instance and the languages loaded into it. */
export class TokenHighlighter {
  #core: Promise<HighlighterCore> | null = null
  #languages = new Map<string, Promise<boolean>>()

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
      const loader = loaders[lang]
      ready = loader ? core.loadLanguage(loader() as never).then(() => true, () => false) : Promise.resolve(false)
      this.#languages.set(lang, ready)
    }
    return ready
  }

  /**
   * Tokens per row index, or null when the language is unknown or the diff is too large.
   * Each hunk's new side (context + added) and old side (context + removed) is tokenized as one
   * blob, so multi-line strings and comments color correctly within a hunk.
   */
  async tokenizeRows(path: string, rows: readonly TokenRow[], patchLength: number): Promise<Map<number, Tok[]> | null> {
    const lang = languageFor(path)
    if (!lang || patchLength > MAX_PATCH) return null
    const core = await this.#highlighter()
    if (!(await this.#ensureLanguage(core, lang))) return null

    const out = new Map<number, Tok[]>()
    const tokenize = (indices: number[], keep: (row: TokenRow) => boolean) => {
      if (!indices.some((i) => keep(rows[i]!))) return
      try {
        const lines = core.codeToTokens(indices.map((i) => rows[i]!.text).join('\n'), {
          lang,
          themes: { dark: 'github-dark-default', light: 'github-light-default' },
          defaultColor: false,
        }).tokens
        indices.forEach((rowIdx, n) => {
          if (keep(rows[rowIdx]!)) out.set(rowIdx, (lines[n] ?? []).map((t) => ({ text: t.content, style: t.htmlStyle })))
        })
      } catch {
        /* leave these rows plain */
      }
    }

    let oldSide: number[] = []
    let newSide: number[] = []
    const flush = () => {
      tokenize(newSide, (r) => r.kind !== 'del')
      tokenize(oldSide, (r) => r.kind === 'del')
      oldSide = []
      newSide = []
    }
    rows.forEach((r, i) => {
      if (r.kind === 'hunk') return flush()
      if (r.kind !== 'add') oldSide.push(i)
      if (r.kind !== 'del') newSide.push(i)
    })
    flush()
    return out
  }
}
