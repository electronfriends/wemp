import { app, Menu, MenuItem, shell, Tray } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as path from 'path'

import config from '../config'
import { startService, stopService } from './service'

export let menu: Menu = null
export let tray: Tray = null

/**
 * Create menu for the system tray.
 */
export function createMenu() {
    menu = new Menu()
    menu.append(new MenuItem({
        icon: path.join(config.paths.icons, 'wemp.png'),
        label: `Wemp ${app.getVersion()}`,
        enabled: false
    }))
    menu.append(new MenuItem({ type: 'separator' }))

    for (let service of config.services) {
        menu.append(new MenuItem({
            icon: path.join(config.paths.icons, service.name.toLowerCase() + '.png'),
            label: service.name,
            submenu: [
                {
                    icon: path.join(config.paths.icons, service.name.toLowerCase() + '.png'),
                    label: `${service.name} ${service.version}`,
                    enabled: false
                },
                { type: 'separator' },
                {
                    icon: path.join(config.paths.icons, 'start.png'),
                    id: `${service.name}-start`,
                    label: 'Start',
                    click: () => startService(service.name)
                },
                {
                    icon: path.join(config.paths.icons, 'restart.png'),
                    id: `${service.name}-restart`,
                    label: 'Restart',
                    click: () => stopService(service.name, true)
                },
                {
                    icon: path.join(config.paths.icons, 'stop.png'),
                    id: `${service.name}-stop`,
                    label: 'Stop',
                    click: () => stopService(service.name)
                },
                { type: 'separator' },
                {
                    icon: path.join(config.paths.icons, 'explorer.png'),
                    label: 'Open Directory',
                    click: () => shell.openPath(path.join(config.paths.services, service.name.toLowerCase()))
                }
            ]
        }))
    }

    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: 'Check for Updates', click: () => autoUpdater.checkForUpdatesAndNotify() }))
    menu.append(new MenuItem({ label: 'Quit Wemp', click: () => app.quit() }))

    tray = new Tray(path.join(config.paths.icons, 'wemp.png'))
    tray.setContextMenu(menu)
    tray.setToolTip('Click to manage Nginx, MariaDB and PHP.')
    tray.on('click', () => tray.popUpContextMenu())
}

/**
 * Update status for service's menu items.
 * 
 * @param service Name of the service
 * @param isStarted Whether the service is started
 */
export function updateMenuStatus(service: string, isStarted: boolean) {
    if (menu) {
        const startItem = menu.getMenuItemById(`${service}-start`)
        const restartItem = menu.getMenuItemById(`${service}-restart`)
        const stopItem = menu.getMenuItemById(`${service}-stop`)

        startItem.enabled = isStarted ? false : true
        restartItem.enabled = stopItem.enabled = !startItem.enabled
    } else {
        console.log(`Tried to update ${service}'s menu item, but menu is not set.`)
    }
}