import fs from 'node:fs';
import path from 'node:path';

import { app, dialog } from 'electron';
import settings from 'electron-settings';
import semverGt from 'semver/functions/gt';

import config, { constants } from '../config';
import download from '../utils/download';
import log from '../utils/logger';
import { onServiceDownload, onServiceDownloadError, onServiceError } from '../utils/notification';
import { createService } from './services';
import { updateMenuStatus } from './menu';

const services = new Map();
let servicesPath = config.paths.services;

/**
 * Get the full path for a service
 * @param {string} serviceId - Service identifier
 * @param {string} [subPath] - Optional sub-path within service directory
 * @returns {string} Full path
 */
function getServicePath(serviceId, subPath) {
  const basePath = path.join(servicesPath, serviceId);
  return subPath ? path.join(basePath, subPath) : basePath;
}

/**
 * Initialize all services, downloading and configuring as needed
 * @throws {Error} If initialization fails
 */
export async function initializeServices() {
  try {
    if (!fs.existsSync(servicesPath)) {
      fs.mkdirSync(servicesPath, { recursive: true });
      await setServicesPath();
    }

    for (const serviceConfig of config.services) {
      if (serviceConfig.id !== 'phpmyadmin') {
        const service = createService(serviceConfig);
        services.set(serviceConfig.id, service);
      }

      const settingsKey = `paths.${servicesPath}.${serviceConfig.id}`;
      const installedVersion = settings.getSync(settingsKey);
      const isFirstDownload = !installedVersion || !fs.existsSync(getServicePath(serviceConfig.id));

      if (isFirstDownload || semverGt(serviceConfig.version, installedVersion)) {
        await updateService(serviceConfig, isFirstDownload);
      }
    }
  } catch (error) {
    log.error('Error during service initialization', error);
    throw error;
  }
}

// Update service files and configuration
async function updateService(serviceConfig, isFirstDownload) {
  const notification = onServiceDownload(serviceConfig, !isFirstDownload);

  try {
    const service = services.get(serviceConfig.id);
    if (service?.shutdown && !isFirstDownload) {
      await service.shutdown();
    }

    await download(serviceConfig, !isFirstDownload);

    if (isFirstDownload) {
      if (service?.install) {
        await service.install();
      } else {
        await setupConfigFromStub(serviceConfig);
      }
    } else if (service?.upgrade) {
      await service.upgrade();
    }

    settings.setSync(`paths.${servicesPath}.${serviceConfig.id}`, serviceConfig.version);
  } catch (error) {
    log.error(`Error setting up '${serviceConfig.name}'`, error);
    onServiceDownloadError(serviceConfig.name);
  } finally {
    notification.close();
  }
}

// Create initial service configuration from stub
async function setupConfigFromStub(serviceConfig) {
  const stubFile = path.join(config.paths.stubs, serviceConfig.id, serviceConfig.config);
  if (!fs.existsSync(stubFile)) return;

  try {
    let content = fs.readFileSync(stubFile, 'utf-8');
    // Use a normalized path with forward slashes for replacement
    const normalizedPath = servicesPath.replace(/\\/g, '/');
    content = content.replace(/{servicesPath}/g, normalizedPath);

    const configDir = path.dirname(getServicePath(serviceConfig.id, serviceConfig.config));
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(getServicePath(serviceConfig.id, serviceConfig.config), content);
  } catch (error) {
    log.error(`Failed to setup config for ${serviceConfig.name}`, error);
    throw error;
  }
}

/**
 * Allow user to select a new services directory
 * @returns {Promise<boolean>} True if path was changed
 */
export async function setServicesPath() {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Choose Services Directory',
    defaultPath: servicesPath,
    properties: ['openDirectory', 'createDirectory']
  });

  if (filePaths?.[0]) {
    servicesPath = filePaths[0];
    settings.setSync('path', servicesPath);
    config.paths.services = servicesPath;
    return true;
  }
  return false;
}

/**
 * Start a service by its ID
 * @param {string} id - Service ID
 * @throws {Error} If service fails to start
 */
export async function startService(id) {
  const service = services.get(id);
  if (!service) {
    log.warn(`Service '${id}' does not exist`);
    return;
  }

  try {
    await service.start();
    updateMenuStatus(id, true);
    watchServiceConfig(id);
  } catch (error) {
    log.error(`Failed to start '${service.name}'`, error);
    onServiceError(service.name);
    throw error;
  }
}

/**
 * Stop a service and optionally restart it
 * @param {string} id - Service ID
 * @param {boolean} [restart=false] - Whether to restart the service
 * @throws {Error} If service fails to stop
 */
export async function stopService(id, restart = false) {
  const service = services.get(id);
  if (!service) return;

  try {
    service.configWatcher?.close();
    await service.stop();
    updateMenuStatus(id, false);

    if (restart) {
      setTimeout(() => startService(id), 1000);
    }
  } catch (error) {
    log.error(`Failed to stop '${service.name}'`, error);
    onServiceError(service.name);
    throw error;
  }
}

/**
 * Start all registered services
 * @returns {Promise<void>} Resolves when all services have started or failed
 */
export async function startServices() {
  const serviceNames = Array.from(services.keys());
  await Promise.allSettled(
    serviceNames.map(name => startService(name))
  );
}

/**
 * Stop all registered services
 * @param {boolean} [restart=false] - Whether to restart the services
 * @returns {Promise<void>} Resolves when all services have stopped
 */
export async function stopServices(restart = false) {
  const serviceNames = Array.from(services.keys());

  const shutdownPromise = Promise.all(
    serviceNames.map(name => stopService(name, restart))
  );

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Services failed to stop within timeout')),
      constants.timeouts.STOP);
  });

  try {
    await Promise.race([shutdownPromise, timeoutPromise]);
  } catch (error) {
    log.error('Failed to stop services', error);
    app.exit(1);
  }
}

// Watch service config file and restart on changes
function watchServiceConfig(id) {
  const service = services.get(id);
  if (!service) return;

  const serviceConfig = config.services.find(s => s.id === id)?.config;
  if (!serviceConfig) return;

  const configPath = getServicePath(id, serviceConfig);
  if (!fs.existsSync(configPath)) return;

  let debounceTimer;
  let isRestarting = false;

  service.configWatcher = fs.watch(configPath, () => {
    if (isRestarting) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        isRestarting = true;
        await stopService(id, true);
      } catch (error) {
        log.error(`Config watch error for ${service.name}`, error);
      } finally {
        isRestarting = false;
      }
    }, constants.timeouts.DEBOUNCE);
  });
}
