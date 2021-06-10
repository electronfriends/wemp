import { dialog } from 'electron'
import settings from 'electron-settings'
import fs from 'fs'
import path from 'path'

import config from '../config'
import download from '../utils/download'
import * as logger from '../utils/logger'
import { onServiceDownload, onServiceDownloadError, onServicesReady } from '../utils/notification'
import { updateMenuStatus } from './menu'

/**
 * Store the service objects in an array.
 */
export const services: any = []

/**
 * Check if services should be installed or need an update.
 */
export function checkServices() {
    return new Promise<void>(async (resolve, reject) => {
        // Check whether the services directory exists
        if (!fs.existsSync(config.paths.services)) {
            fs.mkdirSync(config.paths.services)

            const result = await dialog.showOpenDialog({
                title: 'Choose a directory for the services',
                defaultPath: config.paths.services,
                properties: ['openDirectory']
            })

            const servicesPath = result.filePaths[0] || config.paths.services

            // Remove default service directory because another one is being used
            if (servicesPath !== config.paths.services) {
                fs.rmdirSync(config.paths.services)
            }

            config.paths.services = servicesPath

            settings.setSync({ path: servicesPath })
        }

        // Check if a service needs to be installed or updated
        for (const service of config.services) {
            const serviceName = service.name.toLowerCase()
            const servicePath = path.join(config.paths.services, serviceName)
            const serviceVersion = settings.getSync(serviceName)

            const isFirstDownload = !fs.existsSync(servicePath)

            // Create service instance
            if (!service.interface) services[service.name] = require(`../services/${serviceName}`)

            // Check whether it is the first download or an update
            if (isFirstDownload || serviceVersion !== service.version) {
                const notification = onServiceDownload(service, !isFirstDownload)

                try {
                    await download(service, !isFirstDownload)

                    if (isFirstDownload) {
                        const stubPath = path.join(config.paths.stubs, serviceName)

                        if (fs.existsSync(stubPath)) {
                            await fs.readFile(path.join(stubPath, service.config), (error, contents) => {
                                if (error) reject(error)

                                // Replace services path
                                const content = contents.toString().replace('{servicesPath}', config.paths.services)

                                fs.writeFileSync(path.join(servicePath, service.config), content)
                            })
                        }
                    }

                    // MariaDB needs to be installed on the first run
                    if (isFirstDownload && service.name === 'MariaDB') await services[service.name].install()
                } catch (err) {
                    logger.write(err, onServiceDownloadError(service.name))
                }

                notification.close()
            }

            // Watch for configuration file changes
            if (!service.interface) {
                const serviceConfig = path.join(servicePath, service.config)

                if (fs.existsSync(serviceConfig)) {
                    let debounce

                    fs.watch(serviceConfig, (event, filename) => {
                        if (!filename || debounce) return

                        debounce = setTimeout(() => { debounce = false }, 1000)

                        stopService(service.name, true)
                    })
                }
            }
        }

        resolve()
    })
}

/**
 * Start a service.
 *
 * @param name Name of the service
 */
export function startService(name) {
    const service = services[name]

    if (service) {
        service.start()

        updateMenuStatus(name)
    } else {
        logger.write(`Service '${name}' does not exist.`)
    }
}

/**
 * Start all services.
 */
export function startServices() {
    for (const service of config.services) {
        if (!service.interface) startService(service.name)
    }

    onServicesReady()
}

/**
 * Stop or restart a service.
 *
 * @param name Name of the service
 * @param shouldRestart Whether the service should be restarted
 */
export async function stopService(name, shouldRestart = false) {
    const service = services[name]

    if (service) {
        service.stop()

        updateMenuStatus(name, false)

        if (shouldRestart) {
            setTimeout(() => startService(name), 3000)
        }
    } else {
        logger.write(`Service '${name}' does not exist.`)
    }
}

/**
 * Stop all services.
 */
export function stopServices() {
    for (const service of config.services) {
        if (!service.interface) stopService(service.name)
    }
}
