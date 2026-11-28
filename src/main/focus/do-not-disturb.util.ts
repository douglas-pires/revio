/** The shortcuts Revio adds to the Shortcuts app to turn Do Not Disturb on and off; macOS names them after their files. */
export const REVIO_SHORTCUTS = { on: 'Revio Do Not Disturb On', off: 'Revio Do Not Disturb Off' } as const

/** Do Not Disturb, as the Set Focus action names it. */
const DO_NOT_DISTURB_MODE = 'com.apple.donotdisturb.mode.default'

/** The shortcut names `shortcuts list` printed, one per line. */
export function parseShortcutList(output: string) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Which of Revio's two shortcuts are not in the Shortcuts app yet. */
export function findMissingShortcuts(names: string[]) {
  return Object.values(REVIO_SHORTCUTS).filter((name) => !names.includes(name))
}

/**
 * Which shortcut to run to make Do Not Disturb match `on`, given whether Revio turned it on: none when it already
 * matches, when the switch is off, or when turning off what Revio never turned on (you may have turned it on yourself).
 */
export function pickShortcutToRun(on: boolean, turnedOn: boolean, switchedOn: boolean) {
  if (on === turnedOn || (on && !switchedOn)) {
    return null
  }
  if (on) {
    return REVIO_SHORTCUTS.on
  }
  return REVIO_SHORTCUTS.off
}

/** A shortcut with one Set Focus action that turns Do Not Disturb on (until turned off) or off, as a plist. */
export function buildShortcutPlist(turnOn: boolean) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>WFWorkflowActions</key><array><dict>
<key>WFWorkflowActionIdentifier</key><string>is.workflow.actions.dnd.set</string>
<key>WFWorkflowActionParameters</key><dict>
<key>Enabled</key><integer>${Number(turnOn)}</integer>
<key>AssertionType</key><string>Turned Off</string>
<key>FocusModes</key><dict><key>Identifier</key><string>${DO_NOT_DISTURB_MODE}</string><key>DisplayString</key><string>Do Not Disturb</string></dict>
</dict></dict></array>
<key>WFWorkflowClientVersion</key><string>2302.0.4</string>
<key>WFWorkflowMinimumClientVersion</key><integer>900</integer>
<key>WFWorkflowMinimumClientVersionString</key><string>900</string>
<key>WFWorkflowIcon</key><dict><key>WFWorkflowIconStartColor</key><integer>431817727</integer><key>WFWorkflowIconGlyphNumber</key><integer>59446</integer></dict>
<key>WFWorkflowImportQuestions</key><array/>
<key>WFWorkflowInputContentItemClasses</key><array/>
<key>WFWorkflowTypes</key><array/>
<key>WFQuickActionSurfaces</key><array/>
<key>WFWorkflowHasShortcutInputVariables</key><false/>
</dict></plist>
`
}
