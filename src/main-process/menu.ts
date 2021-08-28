import { app, Menu, MenuItem, shell, Tray } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'

import config from '../config'
import { startService, stopService } from './manager'

export const menu: Menu = new Menu()
export let tray: Tray

/**
 * Create the context menu for the notification area.
 *
 * @returns {void}
 */
export function createMenu(): void {
    menu.append(new MenuItem({
        icon: path.join(config.paths.icons, 'wemp.png'),
        label: `Wemp ${app.getVersion()}`,
        sublabel: 'by ElectronFriends',
        click: () => shell.openPath(config.paths.logs)
    }))

    menu.append(new MenuItem({ type: 'separator' }))

    for (const service of config.services) {
        if (service.interface) continue

        const serviceName = service.name.toLowerCase()

        menu.append(new MenuItem({
            icon: path.join(config.paths.icons, serviceName + '.png'),
            id: service.name,
            label: service.name,
            submenu: [
                {
                    icon: path.join(config.paths.icons, serviceName + '.png'),
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
                    icon: path.join(config.paths.icons, 'file.png'),
                    label: 'Open Configuration',
                    click: () => shell.openPath(path.join(config.paths.services, serviceName, service.config))
                },
                {
                    icon: path.join(config.paths.icons, 'explorer.png'),
                    label: 'Open Directory',
                    click: () => shell.openPath(path.join(config.paths.services, serviceName))
                }
            ]
        }))
    }

    menu.append(new MenuItem({ type: 'separator' }))

    menu.append(new MenuItem({
        icon: path.join(config.paths.icons, 'updates.png'),
        label: 'Check for Updates',
        click: () => autoUpdater.checkForUpdatesAndNotify()
    }))

    menu.append(new MenuItem({
        icon: path.join(config.paths.icons, 'stop.png'),
        label: 'Quit Wemp',
        click: () => app.quit()
    }))

    // Create the system tray
    tray = new Tray(path.join(config.paths.icons, 'wemp.png'))
    tray.setContextMenu(menu)
    tray.setToolTip('Click to manage Nginx, MariaDB and PHP')
    tray.on('click', () => tray.popUpContextMenu())
}

/**
 * Update the status of a menu item.
 *
 * @param name The name of the service.
 * @param isRunning Whether the service is running.
 * @returns {void}
 */
export function updateMenuStatus(name: string, isRunning: boolean): void {
    if (menu.getMenuItemById(name)) {
        const start = menu.getMenuItemById(`${name}-start`)
        const restart = menu.getMenuItemById(`${name}-restart`)
        const stop = menu.getMenuItemById(`${name}-stop`)

        if (start) start.enabled = !isRunning
        if (restart && stop) restart.enabled = stop.enabled = isRunning
    }
}
