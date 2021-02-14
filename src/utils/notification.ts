import { app, Notification, shell } from 'electron'

import { updateMenuStatus } from '../main-process/menu'
import { startService } from '../main-process/service'
import { errorPath } from './logger'

/**
 * Send notification when a service is being downloaded.
 *
 * @param service Service configuration
 * @param isUpdate Whether it's an update or first installation
 * @returns Notification
 */
export function onServiceDownload(service, isUpdate) {
    const notification = new Notification({
        title: isUpdate
            ? `Updating ${service.name} to ${service.version} ...`
            : `Downloading ${service.name} ${service.version} ...`,
        body: 'This may take a moment, please wait and do not close the application.',
        silent: true,
        timeoutType: 'never'
    })

    notification.show()

    return notification
}

/**
 * Send notification when a service could not be downloaded.
 *
 * @param name Service name
 */
export function onServiceDownloadError(name) {
    const notification = new Notification({
        title: `${name} could not be downloaded or installed!`,
        body: 'There was an error downloading or installing the service. Click to open the error logs.',
        timeoutType: 'never'
    })

    notification.on('click', () => shell.openPath(errorPath))

    notification.show()
}

/**
 * Send notification when all services are ready.
 */
export function onServicesReady() {
    const notification = new Notification({
        title: 'Welcome to Wemp!',
        body: 'All services have been started and can now be managed via the menu in the system tray.',
        silent: true
    })

    notification.show()
}

/**
 * Send notification when a service has stopped working.
 *
 * @param name Service name
 */
export function onServiceError(name) {
    const notification = new Notification({
        title: `${name} has stopped working!`,
        body: 'An unexpected error occurred while running the process. Click to open the error logs.',
        timeoutType: 'never'
    })

    notification.on('click', () => shell.openPath(errorPath))

    notification.show()
}

/**
 * Send notification when a new update is available.
 *
 * @param info Update info
 */
export function onUpdateAvailable(info) {
    const notification = new Notification({
        title: 'There is a new update available!',
        body: `Wemp ${info.version} will now be downloaded, we'll let you know when it's ready.`,
        silent: true
    })

    notification.show()
}

/**
 * Send notification when the update has been downloaded.
 *
 * @param info Update info
 */
export function onUpdateDownloaded(info) {
    const notification = new Notification({
        title: `Wemp ${info.version} has been downloaded!`,
        body: 'The update will be applied the next time you launch Wemp. Click to relaunch Wemp now.',
        silent: true
    })

    notification.on('click', () => {
        app.relaunch()
        app.quit()
    })

    notification.show()
}
