import { dialog } from 'electron'
import settings from 'electron-settings'
import fs from 'fs'
import fetch from 'node-fetch'
import path from 'path'

import config from '../config'
import download from '../utils/download'
import * as logger from '../utils/logger'
import { onServiceDownload, onServiceDownloadError, onServiceError } from '../utils/notification'
import { updateMenuStatus } from './menu'

/**
 * Store the service objects in an array.
 */
const services: { [key: string]: any } = []

/**
 * Check if any of the services need to be installed or updated.
 */
export async function checkServices(): Promise<void> {
  if (!fs.existsSync(config.paths.services)) {
    fs.mkdirSync(config.paths.services)
    await setServicesPath()
  }

  for (const service of config.services) {
    const serviceName = service.name.toLowerCase()
    const servicePath = path.join(config.paths.services, serviceName)
    const serviceVersion = settings.getSync(serviceName)

    // Create the service instance
    if (!service.interface) {
      services[service.name] = await import(`../services/${serviceName}.ts`)
    }

    // Check whether it is an installation or an update
    const isFirstDownload = !fs.existsSync(servicePath)

    if (isFirstDownload || serviceVersion !== service.version) {
      const notification = onServiceDownload(service, !isFirstDownload)

      try {
        // MariaDB must be shut down properly before the update
        // This will start MariaDB and shut it down properly via mysqladmin
        if (service.name === 'MariaDB' && !isFirstDownload) {
          await services[service.name].shutdown()
            .then(() => services[service.name].needsUpgrade = true)
            .catch((error: Error) => logger.write(error.message, () => onServiceDownloadError(service.name)))
        }

        await download(service, !isFirstDownload)

        if (isFirstDownload) {
          if (service.name === 'MariaDB') {
            // MariaDB doesn't need a stub, it just needs to be installed
            await services[service.name].install()
          } else {
            // Download the stub configuration file from GitHub
            const response = await fetch(`https://github.com/electronfriends/wemp/raw/main/stubs/${serviceName}/${service.config}`)
            const body = await response.text()

            // Set the services path
            const content = body.replace('{servicesPath}', config.paths.services)

            fs.writeFileSync(path.join(servicePath, service.config), content)
          }
        }
      } catch (error: any) {
        logger.write(error.message, () => onServiceDownloadError(service.name))
      }

      notification.close()
    }

    // Watch for configuration file changes
    if (!service.interface) {
      const serviceConfig = path.join(servicePath, service.config)

      if (fs.existsSync(serviceConfig)) {
        let debounce: NodeJS.Timeout | null

        fs.watch(serviceConfig, (event, filename) => {
          if (!filename || debounce) return
          debounce = setTimeout(() => debounce = null, 1000)
          stopService(service.name, true)
        })
      }
    }
  }
}

/**
 * Set the path to the services.
 */
export async function setServicesPath(): Promise<void> {
  const result = await dialog.showOpenDialog({
    title: 'Choose a folder where the services will be installed',
    defaultPath: config.paths.services,
    properties: ['openDirectory']
  })

  const servicesPath = result.filePaths[0] || config.paths.services

  // Remove the old services directory if it is empty
  if (servicesPath !== config.paths.services) {
    const files = fs.readdirSync(config.paths.services)

    if (files.length === 0) {
      fs.rmdirSync(config.paths.services)
    }
  }

  settings.setSync('path', servicesPath)

  config.paths.services = servicesPath
}

/**
 * Start a service.
 *
 * @param name - The name of the service
 */
export async function startService(name: string): Promise<void> {
  const service = services[name]

  if (service) {
    try {
      await service.start()
        .then(() => updateMenuStatus(name, true))
        .catch((error: any) => logger.write(error.message, () => onServiceError(name)))
    } catch (error: any) {
      logger.write(error.message)
    }

    if (service.needsUpgrade) {
      try {
        await service.upgrade()
          .then(() => service.needsUpgrade = false)
          .catch((error: any) => logger.write(error.message))
      } catch (error: any) {
        logger.write(error.message)
      }
    }
  } else {
    logger.write(`Service '${name}' does not exist.`)
  }
}

/**
 * Start all services.
 */
export async function startServices(): Promise<void> {
  for (const service of config.services) {
    if (service.interface) {
      continue
    }

    await startService(service.name)
  }
}

/**
 * Stop a service.
 *
 * @param name - The name of the service
 * @param shouldRestart - Whether the service should restart
 */
export async function stopService(name: string, shouldRestart = false): Promise<void> {
  const service = services[name]

  if (service) {
    try {
      await service.stop()
        .then(() => updateMenuStatus(name, false))
    } catch (error: any) {
      logger.write(error.message)
    }

    if (shouldRestart) {
      await startService(name)
    }
  } else {
    logger.write(`Service '${name}' does not exist.`)
  }
}

/**
 * Stop all services.
 *
 * @param shouldRestart - Whether the services should restart
 */
export async function stopServices(shouldRestart = false): Promise<void> {
  for (const service of config.services) {
    if (service.interface) {
      continue
    }

    await stopService(service.name, shouldRestart)
  }
}
