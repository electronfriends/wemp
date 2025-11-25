import { EventEmitter } from 'node:events';
import path from 'node:path';

import { dialog } from 'electron';

import config from '../config.js';
import { ConfigWatcher } from './config-watcher.js';
import logger from './logger.js';
import { ProcessManager } from './process-manager.js';
import { ServiceInstaller } from './service-installer.js';
import { VersionManager } from './version-manager.js';

/**
 * Orchestrates service management through dedicated modules
 *
 * Coordinates version checking, installation, process management, and configuration monitoring.
 * Extends EventEmitter to notify about service state changes.
 *
 * @extends EventEmitter
 * @fires ServiceManager#service-started - Emitted when a service starts successfully
 * @fires ServiceManager#service-stopped - Emitted when a service stops
 */
class ServiceManager extends EventEmitter {
  constructor() {
    super();

    /** @type {VersionManager} Manages service versions and updates */
    this.versionManager = new VersionManager();
    /** @type {ProcessManager} Manages service processes */
    this.processManager = new ProcessManager();
    /** @type {ConfigWatcher} Monitors configuration file changes */
    this.configWatcher = new ConfigWatcher();
    /** @type {ServiceInstaller} Handles service installation */
    this.serviceInstaller = new ServiceInstaller(this.versionManager);

    this.processManager.on('process-started', serviceId => {
      this.emit('service-started', serviceId);
    });

    this.processManager.on('process-stopped', serviceId => {
      this.emit('service-stopped', serviceId);
    });

    this.configWatcher.on('config-changed', async serviceId => {
      const serviceName = config.services[serviceId]?.name || serviceId;
      logger.info(`${serviceName} configuration changed, restarting service`);

      try {
        await this.restartService(serviceId);
      } catch (error) {
        // Provide context-specific error messages
        const errorType = error.message.includes('configuration is invalid')
          ? 'configuration validation failed, keeping current configuration'
          : `failed to restart: ${error.message}`;
        logger.error(`${serviceName} ${errorType}`);
      }
    });
  }

  /**
   * Initializes service manager and prepares services for startup
   * @returns {Promise<void>}
   */
  async init() {
    await this.serviceInstaller.ensureServicesPath();

    try {
      // Check for updates (quick API call only)
      await this.versionManager.checkForUpdates();

      if (this.versionManager.hasAvailableUpdates()) {
        logger.info('Service updates available, installing before startup');
        await this.installPendingUpdates();
      }
    } catch (error) {
      // Non-fatal: continue with installed versions if update check fails
      logger.warn('Failed to check for updates on startup', error);
    }

    // Ensure all required services are installed
    await this.serviceInstaller.ensureServicesInstalled();
  }

  /**
   * Installs all pending service updates with retry on file locking
   * @returns {Promise<void>}
   * @private
   */
  async installPendingUpdates() {
    const servicesToUpdate = this.versionManager.getServicesNeedingUpdate();

    for (const serviceId of servicesToUpdate) {
      const serviceName = config.services[serviceId]?.name || serviceId;
      let success = false;

      // Retry loop for file locking issues
      while (!success) {
        try {
          // Stop the service before updating
          await this.stopService(serviceId);

          await this.versionManager.updateService(serviceId);
          success = true;
        } catch (error) {
          logger.warn(`Failed to install update for ${serviceName}`, error);

          // Show dialog asking user what to do
          const response = await dialog.showMessageBox({
            type: 'warning',
            title: `Cannot Update ${serviceName}`,
            message: `Failed to update ${serviceName}.`,
            detail: `This may be because the service or related files are still in use.\n\nTry closing any applications or processes using ${serviceName} and then retry.\n\nError: ${error.message}`,
            buttons: ['Retry', 'Skip This Update'],
            defaultId: 0,
            cancelId: 1,
          });

          // User chose to skip
          if (response.response === 1) {
            logger.info(`Skipped update for ${serviceName}`);
            success = true;
          }
        }
      }
    }
  }

  /**
   * Starts all configured services
   * @returns {Promise<void>}
   */
  async startAll() {
    // Skip phpMyAdmin as it's not a process - it runs via nginx/php
    const services = Object.keys(config.services).filter(id => id !== 'phpmyadmin');

    for (const serviceId of services) {
      try {
        await this.startService(serviceId);
      } catch (error) {
        logger.error(`Failed to start ${serviceId}`, error);
      }
    }
  }

  /**
   * Stops all running services
   * @returns {Promise<void>}
   */
  async stopAll() {
    this.configWatcher.removeAllWatchers();
    return this.processManager.stopAllProcesses();
  }

  /**
   * Starts a specific service and sets up config monitoring
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  async startService(serviceId) {
    // Ensure MariaDB is initialized before starting
    if (serviceId === 'mariadb') {
      await this.serviceInstaller.initializeMariaDB();
    }

    // Auto-fallback for multi-version services with no version selected
    await this.ensureServiceVersionSelected(serviceId);

    // Ensure junction is valid for multi-version services
    this.versionManager.ensureJunction(serviceId);

    const result = await this.processManager.startService(serviceId);
    const servicePath = path.join(config.paths.services, serviceId);
    this.configWatcher.setupWatcher(serviceId, servicePath);
    return result;
  }

  /**
   * Ensures a version is selected for multi-version services, auto-selecting if needed
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   * @private
   */
  async ensureServiceVersionSelected(serviceId) {
    const currentVersion = this.versionManager.getCurrentVersion(serviceId);
    const serviceState = this.versionManager.serviceStates.get(serviceId);

    // Only handle multi-version services with no version selected
    if (currentVersion !== '0.0.0' || !serviceState?.multiVersion) {
      return;
    }

    const availableVersions = serviceState.availableVersions || [];
    if (availableVersions.length === 0) {
      throw new Error(`${config.services[serviceId].name} has no available versions`);
    }

    // Select first non-deprecated version, or first version if all deprecated
    const targetVersion =
      availableVersions.find(v => !v.deprecated)?.version || availableVersions[0].version;

    const serviceName = config.services[serviceId].name;
    logger.info(`${serviceName}: No version selected, auto-selecting ${targetVersion}`);

    await this.versionManager.switchServiceVersion(serviceId, targetVersion);
  }

  /**
   * Stops a specific service and removes config monitoring
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  async stopService(serviceId) {
    this.configWatcher.removeWatcher(serviceId);
    return this.processManager.stopService(serviceId);
  }

  /**
   * Restarts a specific service
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  async restartService(serviceId) {
    const servicePath = path.join(config.paths.services, serviceId);
    await this.processManager.restartProcess(serviceId, servicePath);
  }

  /**
   * Gets current status of all services
   * @returns {Object} Service status map
   */
  getStatus() {
    return this.processManager.getProcessStatus();
  }
}

export const serviceManager = new ServiceManager();
