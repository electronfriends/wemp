import { Notification, shell } from 'electron'

import config from '../config'

/**
 * Show this notification when a service is being downloaded.
 *
 * @param service Service configuration.
 * @param isUpdate Whether it is an update or first installation.
 * @returns {Notification}
 */
export function onServiceDownload(service: any, isUpdate: boolean): Notification {
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
 * Show this notification when a service could not be downloaded.
 *
 * @param name The name of the service.
 * @returns {void}
 */
export function onServiceDownloadError(name: string): void {
    const notification = new Notification({
        title: `${name} could not be downloaded or installed!`,
        body: 'There was an error downloading or installing the service. Click to open the error logs.',
        timeoutType: 'never'
    })

    notification.on('click', () => shell.openPath(config.paths.logs))
    notification.show()
}

/**
 * Show this notification when a service has stopped working.
 *
 * @param name The name of the service.
 * @returns {void}
 */
 export function onServiceError(name: string): void {
    const notification = new Notification({
        title: `${name} has stopped working!`,
        body: 'An unexpected error occurred while running the process. Click to open the error logs.',
        timeoutType: 'never'
    })

    notification.on('click', () => shell.openPath(config.paths.logs))
    notification.show()
}

/**
 * Show this notification when all services are ready.
 *
 * @returns {void}
 */
export function onServicesReady(): void {
    const notification = new Notification({
        title: 'All services have started!',
        body: 'You can now manage them in the notification area by clicking the Wemp icon.',
        silent: true,
        timeoutType: 'never'
    })

    notification.show()
}
