// Renames the development Electron.app to Revio.app, so ⌘Tab, the menu bar and the Dock say "Revio" (with its icon)
// while running `npm run dev`. macOS takes an app's name from its bundle folder as well as its Info.plist, so both
// change, and Electron's path.txt (which `electron` and electron-vite use to find the binary) points at the new folder.
// Packaged builds are named by electron-builder and do not need this. Runs after `npm install` and before
// `npm run dev`; it does nothing when already done.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NAME = 'Revio'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const electronDir = join(root, 'node_modules/electron')
const original = join(electronDir, 'dist/Electron.app')
const branded = join(electronDir, `dist/${NAME}.app`)
const pathFile = join(electronDir, 'path.txt')
const icon = join(root, 'build/icon.icns')
const LSREGISTER = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

if (process.platform !== 'darwin' || process.env.CI || !existsSync(electronDir)) process.exit(0)

// Electron 45+ downloads its binary the first time it is required, not on install; fetch it now so there is a bundle
// to rename before the first `npm run dev`.
try {
  createRequire(import.meta.url)(electronDir)
} catch (err) {
  console.warn('[brand-dev-electron] could not fetch Electron yet:', err instanceof Error ? err.message : err)
}
if (!existsSync(pathFile)) process.exit(0)

const brandedPath = `${NAME}.app/Contents/MacOS/Electron`
if (existsSync(original)) {
  // A fresh Electron.app (first install or an Electron upgrade) replaces any older branded copy.
  rmSync(branded, { recursive: true, force: true })
  renameSync(original, branded)
} else if (!existsSync(branded)) {
  process.exit(0)
}

const plist = join(branded, 'Contents/Info.plist')
const bundledIcon = join(branded, 'Contents/Resources/electron.icns')
const read = (key) => execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', plist], { encoding: 'utf8' }).trim()
const done =
  readFileSync(pathFile, 'utf8') === brandedPath &&
  read('CFBundleName') === NAME &&
  read('CFBundleDisplayName') === NAME &&
  (!existsSync(icon) || readFileSync(icon).equals(readFileSync(bundledIcon)))
if (done) process.exit(0)

writeFileSync(pathFile, brandedPath)
for (const key of ['CFBundleName', 'CFBundleDisplayName']) execFileSync('plutil', ['-replace', key, '-string', NAME, plist])
if (existsSync(icon)) copyFileSync(icon, bundledIcon)
// Editing the bundle breaks Electron's signature; re-sign it ad hoc so macOS still runs it, then tell Launch Services
// about the renamed app (it caches names and icons).
execFileSync('codesign', ['--force', '--deep', '--sign', '-', branded], { stdio: 'ignore' })
execFileSync('touch', [branded])
if (existsSync(LSREGISTER)) execFileSync(LSREGISTER, ['-f', branded])
console.log(`[brand-dev-electron] development Electron.app is now ${NAME}.app`)
