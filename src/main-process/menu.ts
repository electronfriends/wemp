import { app, Menu, MenuItem, shell, Tray } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'

import config from '../config'
import { startService, stopService } from './service'

export let menu: Menu = new Menu()
export let tray: Tray

/**
 * Create context menu for the system tray.
 */
export function createMenu() {
    menu.append(new MenuItem({
        icon: path.join(config.paths.icons, 'wemp.png'),
        label: `Wemp ${app.getVersion()}`,
        sublabel: 'by ElectronFriends',
        click: () => shell.openPath(config.paths.logs)
    }))

    menu.append(new MenuItem({ type: 'separator' }))

    for (const service of config.services) {
        const serviceName = service.name.toLowerCase()

        menu.append(new MenuItem({
            icon: path.join(config.paths.icons, serviceName + '.png'),
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
        click: () => autoUpdater.checkForUpdates()
    }))

    menu.append(new MenuItem({
        icon: path.join(config.paths.icons, 'stop.png'),
        label: 'Shutdown',
        click: () => app.quit()
    }))

    // Create the tray
    tray = new Tray(path.join(config.paths.icons, 'wemp.png'))
    tray.setContextMenu(menu)
    tray.setToolTip('Click to manage Nginx, MariaDB and PHP')
    tray.on('click', () => tray.popUpContextMenu())
}

/**
 * Update the status of a menu item.
 *
 * @param service Name of the service
 * @param isStarted Whether the service is started
 */
export function updateMenuStatus(service: string, isStarted: boolean) {
    const startItem = menu.getMenuItemById(`${service}-start`)
    const stopItem = menu.getMenuItemById(`${service}-stop`)
    const restartItem = menu.getMenuItemById(`${service}-restart`)

    if (startItem && stopItem && restartItem) {
        startItem.enabled = !isStarted
        stopItem.enabled = restartItem.enabled = !startItem.enabled
    }
}
