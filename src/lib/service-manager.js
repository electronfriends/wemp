import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { dialog } from 'electron';
import settings from 'electron-settings';
import semverGt from 'semver/functions/gt';

import config from '../config.js';
import { createService } from '../services/index.js';
import { downloadService } from './downloader.js';
import logger from './logger.js';
import { updateServiceMenuItems } from './menu.js';
import {
  showRestartFailedNotification,
  showServiceCrashedNotification,
  showServiceErrorNotification,
  showServiceInstallNotification,
  showServicesReadyNotification,
} from './notifications.js';

/**
 * Service manager - handles lifecycle of all services
 */
export class ServiceManager {
  constructor() {
    this.services = new Map();
    this.configWatchers = new Map();
    this.configHashes = new Map();
    this.restartCooldowns = new Map();
    this.debounceTimeouts = new Map();
    this.servicesPath = config.paths.services;
  }

  /**
   * Initialize service manager
   */
  async init() {
    if (!fs.existsSync(this.servicesPath)) {
      fs.mkdirSync(this.servicesPath, { recursive: true });
      await this.selectServicesPath();
    }

    const isFirstRun = config.services.every(service => !settings.has(`version.${service.id}`));

    for (const serviceConfig of config.services) {
      if (serviceConfig.executable) {
        const service = createService(serviceConfig);
        this.services.set(serviceConfig.id, service);
      }

      await this.ensureServiceUpToDate(serviceConfig);

      if (serviceConfig.executable) {
        const service = this.services.get(serviceConfig.id);

        const isRunning = await service.isProcessRunning();
        if (isRunning) {
          await service.stop();
        }

        this.setupExitCallback(serviceConfig.id);
      }
    }

    await this.startAll();
    this.setupConfigWatchers();

    if (isFirstRun) {
      showServicesReadyNotification();
    }
  }

  /**
   * Start all services
   */
  async startAll() {
    const promises = Array.from(this.services.keys()).map(id =>
      this.startService(id).catch(error => logger.error(`Failed to start service ${id}`, error))
    );
    await Promise.allSettled(promises);
  }

  /**
   * Stop all services and cleanup
   */
  async stopAll() {
    this.cleanupConfigWatchers();

    const promises = Array.from(this.services.keys()).map(id =>
      this.stopService(id).catch(error => logger.error(`Failed to stop service ${id}`, error))
    );

    await Promise.allSettled(promises);
  }

  /**
   * Start a specific service by ID
   * @param {string} id - Service identifier
   * @throws {Error} If service fails to start
   */
  async startService(id) {
    const service = this.services.get(id);
    if (!service) return;

    try {
      await service.start();
      this.setupExitCallback(id);
      updateServiceMenuItems(id);
    } catch (error) {
      logger.error(`Failed to start ${service.name}`, error);
      throw error;
    }
  }

  /**
   * Stop a specific service by ID
   * @param {string} id - Service identifier
   * @throws {Error} If service fails to stop
   */
  async stopService(id) {
    const service = this.services.get(id);
    if (!service) return;

    try {
      await service.stop();
      updateServiceMenuItems(id);
    } catch (error) {
      logger.error(`Failed to stop ${service.name}`, error);
      throw error;
    }
  }

  /**
   * Restart a specific service by ID
   * @param {string} id - Service identifier
   * @throws {Error} If service fails to stop or start
   */
  async restartService(id) {
    await this.stopService(id);
    setTimeout(() => this.startService(id), config.timeouts.restart);
  }

  /**
   * Get the running status of a service
   * @param {string} id - Service identifier
   * @returns {boolean}
   */
  isServiceRunning(id) {
    const service = this.services.get(id);
    return service ? service.isRunning() : false;
  }

  /**
   * Ensure service is up to date, install if missing or outdated
   * @param {Object} serviceConfig - Service configuration object from config.services
   * @throws {Error} If service update or installation fails
   */
  async ensureServiceUpToDate(serviceConfig) {
    const settingsKey = `version.${serviceConfig.id}`;
    const installedVersion = settings.getSync(settingsKey);
    const isFirstInstall = this.isFirstInstall(serviceConfig);

    if (isFirstInstall || semverGt(serviceConfig.version, installedVersion)) {
      await this.updateService(serviceConfig, isFirstInstall);
    }
  }

  /**
   * Update or install a service
   * @param {Object} serviceConfig - Service configuration object
   * @param {boolean} isFirstInstall - Whether this is a fresh install or update
   * @throws {Error} If download, installation, or upgrade fails
   */
  async updateService(serviceConfig, isFirstInstall) {
    let notification;
    try {
      const service = this.services.get(serviceConfig.id);

      notification = showServiceInstallNotification(
        serviceConfig.name,
        isFirstInstall,
        serviceConfig.version
      );

      if (service && !isFirstInstall) {
        await service.stop();
      }

      await downloadService(serviceConfig, !isFirstInstall);

      if (isFirstInstall && service?.install) {
        await service.install();
      } else if (!isFirstInstall && serviceConfig.id === 'mariadb') {
        service.needsUpgrade = true;
      }

      const settingsKey = `version.${serviceConfig.id}`;
      settings.setSync(settingsKey, serviceConfig.version);
    } catch (error) {
      logger.error(`Failed to update ${serviceConfig.name}`, error);
      showServiceErrorNotification(serviceConfig.name, isFirstInstall);
      throw error;
    } finally {
      if (notification) {
        notification.close();
      }
    }
  }

  /**
   * Check if a service needs first-time installation
   * @param {Object} serviceConfig - Service configuration object
   * @returns {boolean}
   */
  isFirstInstall(serviceConfig) {
    const settingsKey = `version.${serviceConfig.id}`;
    const installedVersion = settings.getSync(settingsKey);
    return !installedVersion || !fs.existsSync(path.join(this.servicesPath, serviceConfig.id));
  }

  /**
   * Setup configuration file watchers
   */
  setupConfigWatchers() {
    for (const service of config.services) {
      const configPath = path.join(this.servicesPath, service.id, service.configFile);

      if (fs.existsSync(configPath)) {
        try {
          // Store initial hash
          const initialHash = this.getFileHash(configPath);
          if (initialHash) {
            this.configHashes.set(service.id, initialHash);
          }

          // Create file watcher with debounced change handler
          const watcher = fs.watch(configPath, () => {
            clearTimeout(this.debounceTimeouts.get(service.id));
            this.debounceTimeouts.set(
              service.id,
              setTimeout(
                () => this.handleConfigChange(service.id, configPath),
                config.watcher.debounce
              )
            );
          });

          this.configWatchers.set(service.id, watcher);
        } catch (error) {
          logger.error(`Failed to set up config watcher for ${service.id}`, error);
        }
      }
    }
  }

  /**
   * Handle configuration file changes with cooldown and content verification
   * @param {string} serviceId - Service identifier whose config changed
   * @param {string} configPath - Full path to the changed configuration file
   */
  async handleConfigChange(serviceId, configPath) {
    const now = Date.now();
    const lastRestart = this.restartCooldowns.get(serviceId) || 0;

    if (now - lastRestart < config.watcher.restartCooldown) {
      return;
    }

    // Check if content actually changed by comparing hashes
    const currentHash = this.getFileHash(configPath);
    const previousHash = this.configHashes.get(serviceId);

    if (!currentHash || currentHash === previousHash) {
      return;
    }

    this.configHashes.set(serviceId, currentHash);
    this.restartCooldowns.set(serviceId, now);

    const service = this.services.get(serviceId);
    if (!service) return;

    try {
      if (this.isServiceRunning(serviceId)) {
        await this.stopService(serviceId);
        setTimeout(async () => {
          try {
            await this.startService(serviceId);
          } catch (error) {
            logger.error(`Failed to restart ${serviceId} after config change`, error);
            showRestartFailedNotification(service.name, error.message);
          }
        }, config.timeouts.restart);
      }
    } catch (error) {
      logger.error(`Error handling config change for ${serviceId}`, error);
    }
  }

  /**
   * Clean up config watchers
   */
  cleanupConfigWatchers() {
    // Clean up file watchers
    for (const [key, watcher] of this.configWatchers) {
      try {
        watcher.close();
      } catch (error) {
        logger.error(`Error cleaning up watcher for ${key}`, error);
      }
    }
    this.configWatchers.clear();

    // Clean up debounce timeouts
    for (const [key, timeout] of this.debounceTimeouts) {
      try {
        clearTimeout(timeout);
      } catch (error) {
        logger.error(`Error cleaning up timeout for ${key}`, error);
      }
    }
    this.debounceTimeouts.clear();

    this.configHashes.clear();
    this.restartCooldowns.clear();
  }

  /**
   * Set up exit callback for a service process
   * @param {string} id - Service identifier
   */
  setupExitCallback(id) {
    const service = this.services.get(id);
    if (service?.process) {
      service.process.setUnexpectedExitCallback((code, signal) => {
        this.handleUnexpectedExit(id, code, signal);
      });
    }
  }

  /**
   * Handle unexpected service exit - log and notify user
   * @param {string} serviceId - Service identifier that crashed
   * @param {number} code - Exit code from the process
   * @param {string} signal - Signal that terminated the process
   */
  async handleUnexpectedExit(serviceId, code, signal) {
    logger.error(
      `Service ${serviceId} crashed unexpectedly (exit code: ${code}, signal: ${signal})`
    );
    updateServiceMenuItems(serviceId);

    const service = this.services.get(serviceId);
    if (service) {
      showServiceCrashedNotification(service.name);
    }
  }

  /**
   * Prompt user to select services directory
   * @returns {Promise<boolean>}
   */
  async selectServicesPath() {
    const result = await dialog.showOpenDialog({
      title: 'Choose Services Directory',
      defaultPath: this.servicesPath,
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result && !result.canceled && result.filePaths?.length > 0) {
      this.servicesPath = result.filePaths[0];
      settings.setSync('path', this.servicesPath);
      return true;
    }
    return false;
  }

  /**
   * Calculate hash of file content
   * @param {string} filePath
   * @returns {string|null}
   */
  getFileHash(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return createHash('md5').update(content).digest('hex');
    } catch (error) {
      logger.error(`Failed to read file for hashing: ${filePath}`, error);
      return null;
    }
  }
}

export const serviceManager = new ServiceManager();
