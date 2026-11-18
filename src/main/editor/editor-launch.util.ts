/** How an editor opens a file at a line. */
export type LaunchStyle =
  /** A URL scheme taking `<scheme>://file/<path>:<line>` (VS Code and its forks). */
  | { kind: 'url'; scheme: string }
  /** A command-line tool inside the app bundle taking `<path>:<line>`. */
  | { kind: 'bundled-cli'; cli: string }
  /** JetBrains IDEs: `open -na <app> --args --line <n> <path>` hands the file to the running IDE. */
  | { kind: 'jetbrains' }
  /** Anything else: `open -a <app> <path>`, without the line. */
  | { kind: 'open' }

export interface EditorSpec {
  id: string
  name: string
  /** The app bundle's name, without `.app`. */
  app: string
  launch: LaunchStyle
}

const jetbrains = (id: string, app: string): EditorSpec => ({ id, name: app, app, launch: { kind: 'jetbrains' } })

/** Editors Revio knows, in the order it prefers them when none is chosen. */
export const EDITORS: readonly EditorSpec[] = [
  { id: 'cursor', name: 'Cursor', app: 'Cursor', launch: { kind: 'url', scheme: 'cursor' } },
  { id: 'vscode', name: 'Visual Studio Code', app: 'Visual Studio Code', launch: { kind: 'url', scheme: 'vscode' } },
  { id: 'vscode-insiders', name: 'VS Code Insiders', app: 'Visual Studio Code - Insiders', launch: { kind: 'url', scheme: 'vscode-insiders' } },
  { id: 'windsurf', name: 'Windsurf', app: 'Windsurf', launch: { kind: 'url', scheme: 'windsurf' } },
  { id: 'zed', name: 'Zed', app: 'Zed', launch: { kind: 'bundled-cli', cli: 'Contents/MacOS/cli' } },
  jetbrains('intellij', 'IntelliJ IDEA'),
  jetbrains('intellij-ce', 'IntelliJ IDEA CE'),
  jetbrains('webstorm', 'WebStorm'),
  jetbrains('pycharm', 'PyCharm'),
  jetbrains('pycharm-ce', 'PyCharm CE'),
  jetbrains('goland', 'GoLand'),
  jetbrains('phpstorm', 'PhpStorm'),
  jetbrains('rubymine', 'RubyMine'),
  jetbrains('rider', 'Rider'),
  jetbrains('clion', 'CLion'),
  jetbrains('rustrover', 'RustRover'),
  { id: 'sublime', name: 'Sublime Text', app: 'Sublime Text', launch: { kind: 'bundled-cli', cli: 'Contents/SharedSupport/bin/subl' } },
  { id: 'nova', name: 'Nova', app: 'Nova', launch: { kind: 'open' } },
  { id: 'xcode', name: 'Xcode', app: 'Xcode', launch: { kind: 'open' } },
]

/** What to run, or which URL to open, to show `file` (absolute) at `line` in the editor installed at `appPath`. */
export type Launch = { url: string } | { command: string; args: string[] }

export function launchFor(editor: EditorSpec, appPath: string, file: string, line?: number): Launch {
  const at = line ? `${file}:${line}` : file
  switch (editor.launch.kind) {
    case 'url':
      return { url: `${editor.launch.scheme}://file${encodeURI(at).replace(/[#?]/g, encodeURIComponent)}` }
    case 'bundled-cli':
      return { command: `${appPath}/${editor.launch.cli}`, args: [at] }
    case 'jetbrains':
      return { command: 'open', args: ['-na', appPath, '--args', ...(line ? ['--line', String(line)] : []), file] }
    case 'open':
      return { command: 'open', args: ['-a', appPath, file] }
  }
}
