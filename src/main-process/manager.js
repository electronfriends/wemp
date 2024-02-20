import fs from 'fs';
import path from 'path';

import { dialog } from 'electron';
import settings from 'electron-settings';
import semverGt from 'semver/functions/gt';

import config from '../config';
import * as serviceModules from '../services';
import download from '../utils/download';
import logger from '../utils/logger';
import { onServiceDownload, onServiceDownloadError, onServiceError } from '../utils/notification';
import { updateMenuStatus } from './menu';

const services = {};
let servicesPath = config.paths.services;

/**
 * Check to see if any services need to be installed or updated.
 */
export async function checkServices() {
  try {
    if (!fs.existsSync(servicesPath)) {
      fs.mkdirSync(servicesPath, { recursive: true });
      await setServicesPath();
    }

    for (const service of config.services) {
      const serviceName = service.name.toLowerCase();
      const servicePath = path.join(servicesPath, serviceName);
      const serviceVersion = settings.getSync(`paths.${servicesPath}.${serviceName}`);

      let currentService;
      if (service.name !== 'phpMyAdmin') {
        currentService = services[service.name] = new serviceModules[serviceName]();
      }

      const isFirstDownload = !fs.existsSync(servicePath);

      if (isFirstDownload || semverGt(service.version, serviceVersion)) {
        const notification = onServiceDownload(service, !isFirstDownload);

        try {
          // Perform a graceful shutdown for MariaDB before updating.
          if (service.name === 'MariaDB' && !isFirstDownload) {
            await currentService.shutdown();
          }

          await download(service, !isFirstDownload);

          if (isFirstDownload) {
            if (service.name === 'MariaDB') {
              await currentService.install();
            } else {
              const serviceConfigPath = path.join(__dirname, `../../stubs/${serviceName}/${service.config}`);
              const content = fs.readFileSync(serviceConfigPath, 'utf8');
              const modifiedContent = content.replace('{servicesPath}', servicesPath);
              fs.writeFileSync(path.join(servicePath, service.config), modifiedContent);
            }
          }

          settings.setSync(`paths.${servicesPath}.${serviceName}`, service.version);
        } catch (error) {
          logger(`Error while downloading service '${service.name}': ${error}`);
          onServiceDownloadError(service.name);
        } finally {
          notification.close();
        }
      }
    }
  } catch (error) {
    logger(`Error while checking services: ${error}`);
  }
}

/**
 * Set the path for the services from the web server.
 */
export async function setServicesPath() {
  const result = await dialog.showOpenDialog({
    title: 'Choose a directory where you want Wemp to install the services',
    defaultPath: servicesPath,
    properties: ['openDirectory']
  });

  const chosenPath = result.filePaths[0] || servicesPath;

  // Update settings and config.
  settings.setSync('path', chosenPath);
  config.paths.services = chosenPath;
  servicesPath = chosenPath;
}

/**
 * Watch for changes in the service configuration file.
 * @param {string} serviceName - The name of the service.
 */
function watchServiceConfig(serviceName) {
  const service = services[serviceName];
  const serviceConfig = config.services.find(s => s.name === serviceName)?.config;

  if (service && serviceConfig) {
    const serviceConfigPath = path.join(servicesPath, serviceName, serviceConfig);
    if (fs.existsSync(serviceConfigPath)) {
      service.debounce = service.debounce || null;

      clearTimeout(service.debounce);

      service.debounce = setTimeout(() => {
        service.debounce = null;
      }, 1000);

      service.configWatcher = fs.watch(serviceConfigPath, (event, filename) => {
        if (filename && !service.debounce) {
          stopService(serviceName, true);
        }
      });
    }
  }
}

/**
 * Start the specified service if it exists.
 * @param {string} name - The name of the service to start.
 */
export async function startService(name) {
  const service = services[name];

  if (service) {
    try {
      await service.start();
      updateMenuStatus(name, true);
      watchServiceConfig(name);
    } catch (error) {
      logger(`Failed to start service '${name}': ${error}`);
      onServiceError(name);
    }
  } else {
    logger(`Service '${name}' does not exist.`);
  }
}

/**
 * Stop a service and optionally restart it if specified.
 * @param {string} name - The name of the service to stop.
 * @param {boolean} shouldRestart - Whether the service should restart after stopping.
 */
export async function stopService(name, shouldRestart = false) {
  const service = services[name];

  if (service) {
    try {
      if (service.configWatcher) {
        service.configWatcher.close();
        delete service.configWatcher;
      }
      await service.stop();
      updateMenuStatus(name, false);
      if (shouldRestart) {
        setTimeout(() => startService(name), 500);
      }
    } catch (error) {
      logger(`Failed to stop service '${name}': ${error}`);
      onServiceError(name);
    }
  } else {
    logger(`Service '${name}' does not exist.`);
  }
}

/**
 * Starts all services defined in the configuration.
 */
export async function startServices() {
  await Promise.all(
    config.services
      .filter(service => service.name !== 'phpMyAdmin')
      .map(service => startService(service.name))
  );
}

/**
 * Stops all services defined in the configuration.
 * @param {boolean} shouldRestart - Whether the services should restart after stopping.
 * @returns {Promise<void>}
 */
export async function stopServices(shouldRestart = false) {
  await Promise.all(
    config.services
      .filter(service => service.name !== 'phpMyAdmin')
      .map(service => stopService(service.name, shouldRestart))
  );
}
