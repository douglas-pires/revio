import type { PullFile } from '@shared/pull.types.ts'

type ViewedFile = Pick<PullFile, 'path' | 'sha'>

const isViewed = (file: ViewedFile, viewed: Readonly<Record<string, string>>) => viewed[file.path] === file.sha

/**
 * The file to unview: the one you are reading when it is viewed, else the one you marked last, so it takes back a mark
 * that already moved you on. `viewed` keeps its files in the order they were marked. Undefined when none is viewed.
 */
export function pickFileToUnview<T extends ViewedFile>(
  files: readonly T[],
  viewed: Readonly<Record<string, string>>,
  readingPath: string | null,
): T | undefined {
  const viewedFiles = files.filter((file) => isViewed(file, viewed))
  const lastPath = Object.keys(viewed).findLast((path) => viewedFiles.some((file) => file.path === path))
  const reading = viewedFiles.find((file) => file.path === readingPath)
  return reading ?? viewedFiles.find((file) => file.path === lastPath)
}
