import path from 'path';
import fs from 'fs';

import { dialog } from 'electron';
import settings from 'electron-settings';
import fetch from 'node-fetch';

import config from '../config';
import * as serviceModules from '../services';
import download from '../utils/download';
import logger from '../utils/logger';
import { onServiceDownload, onServiceDownloadError, onServiceError } from '../utils/notification';
import { updateMenuStatus } from './menu';

const services = {};
const servicesPath = config.paths.services;

/**
 * Check to see if any services need to be installed or updated.
 */
export async function checkServices() {
  if (!fs.existsSync(servicesPath)) {
    fs.mkdirSync(servicesPath, { recursive: true });
    await setServicesPath();
  }

  for (const service of config.services) {
    if (service.interface) continue;

    // Prepare service-related variables.
    const serviceName = service.name.toLowerCase();
    const servicePath = path.join(servicesPath, serviceName);
    const serviceVersion = settings.getSync(serviceName);

    // Dynamically instantiate the service module.
    const currentService = services[service.name] = new serviceModules[serviceName]();

    // Check if it's the first download.
    const isFirstDownload = !fs.existsSync(servicePath);

    // If it's the first download or service version has changed.
    if (isFirstDownload || serviceVersion !== service.version) {
      const notification = onServiceDownload(service, !isFirstDownload);

      try {
        // Perform a graceful shutdown for MariaDB before updating.
        if (service.name === 'MariaDB' && !isFirstDownload) {
          await currentService.shutdown();
        }

        // Download the service.
        await download(service, !isFirstDownload);

        // Handle first download scenarios.
        if (isFirstDownload) {
          if (service.name === 'MariaDB') {
            await currentService.install();
          } else {
            const response = await fetch(`https://github.com/electronfriends/wemp/raw/main/stubs/${serviceName}/${service.config}`);
            const body = await response.text();
            const content = body.replace('{servicesPath}', servicesPath);
            fs.writeFileSync(path.join(servicePath, service.config), content);
          }
        }
      } catch (error) {
        logger(`Failed to download service '${service.name}': ${error.message}`);
        onServiceDownloadError(service.name);
      } finally {
        notification.close();
      }
    }
  }
}

/**
 * Set the path for the services from the web server.
 */
export async function setServicesPath() {
  const result = await dialog.showOpenDialog({
    title: 'Choose a location for the services from the web server',
    defaultPath: servicesPath,
    properties: ['openDirectory']
  });

  const chosenPath = result.filePaths[0] || servicesPath;

  // Remove the default service path if it is empty.
  if (chosenPath !== servicesPath) {
    try {
      const files = fs.readdirSync(chosenPath);
      if (files.length === 0) {
        fs.rmdirSync(chosenPath);
      }
    } catch (error) {
      logger(`Error while checking or removing directory: ${error.message}`);
    }
  }

  // Update settings and config.
  settings.setSync('path', chosenPath);
  servicesPath = chosenPath;
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
    } catch (error) {
      logger(`Failed to start service '${name}': ${error.message}`);
      onServiceError(name);
    }
  } else {
    logger(`Service '${name}' does not exist.`);
  }
}

/**
 * Start all non-interface services defined in the configuration.
 */
export async function startServices() {
  await Promise.all(
    config.services
      .filter(service => !service.interface)
      .map(service => startService(service.name))
  );
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
      await service.stop();
      updateMenuStatus(name, false);

      if (shouldRestart) {
        await startService(name);
      }
    } catch (error) {
      logger(`Failed to stop service '${name}': ${error.message}`);
      onServiceError(name);
    }
  } else {
    logger(`Service '${name}' does not exist.`);
  }
}

/**
 * Stops all non-interface services defined in the configuration.
 * @returns {Promise<void>}
 */
export async function stopServices() {
  await Promise.all(
    config.services
      .filter(service => !service.interface)
      .map(service => stopService(service.name))
  );
}
