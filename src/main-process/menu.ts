import { app, Menu, MenuItem, shell, Tray } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'

import config from '../config'
import * as logger from '../utils/logger'
import { setServicesPath, startService, stopService, stopServices } from './manager'

/**
 * The context menu.
 */
export const menu: Menu = new Menu()

/**
 * The system tray to open the context menu.
 */
export let tray: Tray

/**
 * Create the menu template.
 */
export function createMenu(): void {
    menu.append(new MenuItem({
        icon: path.join(config.paths.icons, 'wemp.png'),
        label: `Wemp ${app.getVersion()}`,
        sublabel: 'by ElectronFriends',
        submenu: [
            {
                icon: path.join(config.paths.icons, 'restart.png'),
                label: 'Restart All Services',
                click: () => stopServices(true)
            },
            {
                icon: path.join(config.paths.icons, 'folder.png'),
                label: 'Set Services Path',
                click: () => setServicesPath().then(() => stopServices(true))
            },
            {
                icon: path.join(config.paths.icons, 'event-log.png'),
                label: 'View Error Logs',
                click: () => shell.openPath(config.paths.logs)
            }
        ]
    }))

    menu.append(new MenuItem({ type: 'separator' }))

    for (const service of config.services) {
        if (service.interface) {
            continue
        }

        const serviceName = service.name.toLowerCase()

        menu.append(new MenuItem({
            icon: path.join(config.paths.icons, serviceName + '.png'),
            id: service.name,
            label: service.name,
            visible: false,
            submenu: [
                {
                    icon: path.join(config.paths.icons, serviceName + '.png'),
                    label: `${service.name} ${service.version}`,
                    enabled: false
                },
                { type: 'separator' },
                {
                    icon: path.join(config.paths.icons, 'circled-play.png'),
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
                    icon: path.join(config.paths.icons, 'shutdown.png'),
                    id: `${service.name}-stop`,
                    label: 'Stop',
                    click: () => stopService(service.name)
                },
                { type: 'separator' },
                {
                    icon: path.join(config.paths.icons, 'settings.png'),
                    label: 'Open Configuration',
                    click: () => shell.openPath(path.join(config.paths.services, serviceName, service.config))
                },
                {
                    icon: path.join(config.paths.icons, 'file-explorer.png'),
                    label: 'Open Directory',
                    click: () => shell.openPath(path.join(config.paths.services, serviceName))
                }
            ]
        }))
    }

    menu.append(new MenuItem({ type: 'separator' }))

    menu.append(new MenuItem({
        icon: path.join(config.paths.icons, 'update.png'),
        label: 'Check for Updates',
        click: () => autoUpdater.checkForUpdatesAndNotify()
    }))

    menu.append(new MenuItem({
        icon: path.join(config.paths.icons, 'shutdown.png'),
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
 * @param name - The name of the service
 * @param isRunning - Whether the service is running
 */
export function updateMenuStatus(name: string, isRunning: boolean): void {
    const serviceItem = menu.getMenuItemById(name)

    if (serviceItem) {
        const startItem = menu.getMenuItemById(`${name}-start`)
        const restartItem = menu.getMenuItemById(`${name}-restart`)
        const stopItem = menu.getMenuItemById(`${name}-stop`)

        if (startItem) {
            startItem.enabled = !isRunning
        }

        if (restartItem && stopItem) {
            restartItem.enabled = stopItem.enabled = isRunning
        }

        if (!serviceItem.visible) {
            serviceItem.visible = true
        }
    } else {
        logger.write(`Menu for service '${name}' does not exist.`)
    }
}
