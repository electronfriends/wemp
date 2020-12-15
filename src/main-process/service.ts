import { dialog } from 'electron'
import * as settings from 'electron-settings'
import * as fs from 'fs'
import * as path from 'path'

import config from '../config'
import download from '../utils/download'
import { updateMenuStatus } from './menu'
import { window } from './window'

export const services: Object = []

/**
 * Check if services are installed or need an update.
 */
export function checkServices() {
    return new Promise<void>(async (resolve, reject) => {
        try {
            // Check if services folder is set and exists
            if (!config.paths.services || !fs.existsSync(config.paths.services)) {
                const filePaths = dialog.showOpenDialogSync(window, {
                    title: 'Tell us where to create the Wemp-folder for the services',
                    defaultPath: 'C:\\',
                    properties: ['openDirectory']
                })

                const wempPath = path.join(filePaths ? filePaths[0] : 'C:\\', 'Wemp')

                if (!fs.existsSync(wempPath)) fs.mkdirSync(wempPath)

                config.paths.services = wempPath

                settings.setSync('path', wempPath)
            }

            // Check if services should be installed or updated
            for (let service of config.services) {
                const servicePath = path.join(config.paths.services, service.name.toLowerCase())
                const serviceVersion = settings.getSync(service.name.toLowerCase())

                const isFirstDownload = !fs.existsSync(servicePath)

                if (isFirstDownload || serviceVersion !== service.version) {
                    window.webContents.send('update-titles', {
                        title: isFirstDownload ? `Downloading ${service.name} ...` : `Updating ${service.name} to ${service.version} ...`,
                        subtitle: 'This may take a while, please do not close the window.'
                    })

                    await download(service, !isFirstDownload)
                }

                // Instanciate service and store
                services[service.name] = require(`../services/${service.name.toLowerCase()}`)

                if (isFirstDownload) await services[service.name].install()
            }

            resolve()
        } catch(error) {
            reject(error)
        }
    })
}

/**
 * Start a service.
 *
 * @param name Name of the service
 */
export function startService(name: string) {
    const service = services[name]

    if (service && !service.started) {
        service.start()
        updateMenuStatus(name, true)
    } else {
        console.log(`Service '${name}' does not exist.`)
    }
}

/**
 * Start all services.
 */
export function startServices() {
    for (let service of config.services) {
        startService(service.name)
    }
}

/**
 * Stop or restart a service.
 *
 * @param name Name of the service
 * @param shouldRestart Whether the service should be restarted
 */
export function stopService(name: string, shouldRestart: boolean = false) {
    if (services[name]) {
        services[name].stop()

        updateMenuStatus(name, false)

        if (shouldRestart) {
            setTimeout(() => startService(name), 2000)
        }
    } else {
        console.log(`Service '${name}' does not exist.`)
    }
}

/**
 * Stop all services.
 */
export function stopServices() {
    for (let service of config.services) {
        stopService(service.name)
    }
}