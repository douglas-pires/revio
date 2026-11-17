import { Menu, type MenuItemConstructorOptions } from 'electron'

export interface MenuActions {
  navigate: (direction: 'back' | 'forward') => void
}

/** The macOS menu bar: the standard app, edit, view and window menus, plus Go (back/forward). */
export function installAppMenu(actions: MenuActions) {
  const template: MenuItemConstructorOptions[] = [
    {
      role: 'appMenu',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Go',
      submenu: [
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => actions.navigate('back') },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => actions.navigate('forward') },
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
