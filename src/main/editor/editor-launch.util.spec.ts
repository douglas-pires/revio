import { describe, expect, it } from 'vitest'
import { EDITORS, launchFor } from './editor-launch.util'

const editor = (id: string) => EDITORS.find((e) => e.id === id)!

describe('launchFor', () => {
  it('opens VS Code-style editors by URL, escaping characters a URL would misread', () => {
    expect(launchFor(editor('vscode'), '/Applications/Visual Studio Code.app', '/Users/me/My Repo/a#b.ts', 12)).toEqual({
      url: 'vscode://file/Users/me/My%20Repo/a%23b.ts:12',
    })
    expect(launchFor(editor('cursor'), '/x', '/r/a.ts')).toEqual({ url: 'cursor://file/r/a.ts' })
  })

  it('runs the bundled CLI with path:line', () => {
    expect(launchFor(editor('zed'), '/Applications/Zed.app', '/r/a.ts', 3)).toEqual({ command: '/Applications/Zed.app/Contents/MacOS/cli', args: ['/r/a.ts:3'] })
  })

  it('hands JetBrains IDEs the line as a flag', () => {
    expect(launchFor(editor('pycharm'), '/Applications/PyCharm.app', '/r/a.py', 7)).toEqual({
      command: 'open',
      args: ['-na', '/Applications/PyCharm.app', '--args', '--line', '7', '/r/a.py'],
    })
    expect(launchFor(editor('webstorm'), '/A/WebStorm.app', '/r/a.ts')).toEqual({ command: 'open', args: ['-na', '/A/WebStorm.app', '--args', '/r/a.ts'] })
  })

  it('falls back to open -a without a line', () => {
    expect(launchFor(editor('nova'), '/Applications/Nova.app', '/r/a.ts', 4)).toEqual({ command: 'open', args: ['-a', '/Applications/Nova.app', '/r/a.ts'] })
  })
})
