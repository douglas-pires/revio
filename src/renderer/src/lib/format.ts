export function ago(iso: string | null | undefined) {
  if (!iso) return ''
  const h = (Date.now() - new Date(iso).getTime()) / 36e5
  return duration(h)
}

export function duration(h: number) {
  if (h < 1 / 60) return 'now'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const errorMessage = (e: unknown) =>
  (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

const GENERATED = [/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|go\.sum|composer\.lock)$/, /\.snap$/, /(^|\/)(dist|build|generated|__generated__)\//, /\.min\.(js|css)$/]
export const isGenerated = (path: string) => GENERATED.some((r) => r.test(path))
