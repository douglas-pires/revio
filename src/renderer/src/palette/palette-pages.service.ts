import type { PaletteEntry, PalettePage } from './palette.types.ts'

type ReadPage = () => PalettePage

/** The screens now showing, each ready to say what can be done on it. Read when the palette opens. */
const pages = new Set<ReadPage>()

export function addPalettePage(readPage: ReadPage) {
  pages.add(readPage)
  return () => {
    pages.delete(readPage)
  }
}

/** What can be done now: the current screen's actions first, then those of everywhere. */
export function listPaletteEntries(): PaletteEntry[] {
  const showing = [...pages].map((readPage) => readPage())
  const ordered = [...showing.filter((page) => !page.everywhere), ...showing.filter((page) => page.everywhere)]
  return ordered.flatMap(({ name, actions }) => actions.map((action) => ({ ...action, page: name })))
}
