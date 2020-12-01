import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as path from 'path'

import config from '../config'
import { createMenu } from './menu'
import { checkServices, startServices } from './service'

export let window: BrowserWindow = null

/**
 * Create the main window.
 */
export function createWindow() {
    window = new BrowserWindow({
        width: 600,
        height: 400,
        title: 'Wemp',
        icon: path.join(config.paths.icons, '../wemp.ico'),
        frame: false,
        transparent: true,
        webPreferences: {
            devTools: false,
            preload: path.join(app.getAppPath(), 'dist/renderer/preload.js')
        }
    })

    window.loadFile(path.join(app.getAppPath(), 'public/index.html'))

    window.webContents.once('did-finish-load', async () => {
        try {
            await checkServices()
            createMenu()
            startServices()

            if (app.isPackaged) {
                autoUpdater.checkForUpdatesAndNotify()
                setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 30 * 60 * 1000)
            }

            window.webContents.send('update-titles', {
                title: 'Wemp is ready!',
                subtitle: 'You can manage the services by clicking our icon in the system tray.'
            })

            window.webContents.send('start-countdown')

            ipcMain.on('countdown-complete', () => window.hide())
        } catch (error) {
            if (!window.isVisible()) window.show()

            window.webContents.send('update-titles', {
                title: 'An unexpected error occurred!',
                subtitle: error
            })
        }
    })
}