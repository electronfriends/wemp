import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

import { checkServices, startServices, stopServices } from './main-process/manager'
import { createMenu, tray } from './main-process/menu'
import { onServicesReady } from './utils/notification'

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    app.quit()
} else {
    // Set the Application User Model ID
    app.setAppUserModelId('com.electronfriends.wemp')

    // Someone tried to run a second instance, we should focus the tray
    app.on('second-instance', () => {
        if (tray) tray.focus()
    })

    // Stop all services before quitting
    app.on('before-quit', async (event) => {
        event.preventDefault()
        await stopServices()
        app.exit()
    })

    // Set everything up as soon as our application is ready
    app.whenReady().then(async () => {
        await checkServices().then(createMenu)
        await startServices().then(onServicesReady)

        if (app.isPackaged) {
            autoUpdater.checkForUpdatesAndNotify()

            // Check for updates every 30 minutes
            setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 30 * 60 * 1000)
        }
    })
}
