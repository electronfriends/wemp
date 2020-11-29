import { Notification } from 'electron'

import { updateMenuStatus } from '../main-process/menu'
import { startService } from '../main-process/service'

/**
 * Send a notification when a service is stopped.
 * 
 * @param name Name of the service
 */
export function onServiceStopped(name: string) {
    const notification = new Notification({
        title: `${name} has stopped!`,
        body: 'The process has stopped. If this was not intended, click to restart the process.',
        silent: true
    })

    notification.on('click', () => startService(name))
    notification.show()

    updateMenuStatus(name, false)
}