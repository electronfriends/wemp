import { Notification, shell } from 'electron'

import config from '../config'

/**
 * Send notification when a service is being downloaded.
 *
 * @param service Service configuration
 * @param isUpdate Whether it's an update or first download
 * @returns Notification
 */
export function onServiceDownload(service, isUpdate) {
    const notification = new Notification({
        title: isUpdate
            ? `Updating ${service.name} to ${service.version} ...`
            : `Downloading ${service.name} ${service.version} ...`,
        body: 'This may take a while, please wait and do not close the application.',
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

    notification.on('click', () => shell.openPath(config.paths.logs))

    notification.show()
}

/**
 * Send notification when all services are ready.
 */
export function onServicesReady() {
    const notification = new Notification({
        title: 'Welcome to Wemp!',
        body: 'All services have started and can now be managed via the menu in the notification area.',
        silent: true,
        timeoutType: 'never'
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

    notification.on('click', () => shell.openPath(config.paths.logs))

    notification.show()
}
