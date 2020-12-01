import { app } from 'electron'

import { tray } from './main-process/menu'
import { stopServices } from './main-process/service'
import { createWindow } from './main-process/window'

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    app.quit()
} else {
    // Someone tried to run a second instance, we should focus the context menu
    app.on('second-instance', () => {
        if (tray) tray.popUpContextMenu()
    })

    // Stop all running services before quitting
    app.on('before-quit', event => {
        event.preventDefault()
        stopServices()
        process.exit()
    })

    // Create window when ready
    app.whenReady().then(createWindow)

    // Set the correct Application User Model ID
    app.setAppUserModelId('com.electronfriends.wemp')
}