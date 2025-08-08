import { createHash } from 'node:crypto';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { dialog } from 'electron';
import settings from 'electron-settings';
import semverGt from 'semver/functions/gt';

import config from '../config.js';
import { createService } from '../services/index.js';
import { downloadService } from './downloader.js';
import logger from './logger.js';
import { updateServiceMenuItems } from './menu.js';
import {
  showReadyNotification,
  showRestartFailedNotification,
  showServiceCrashedNotification,
  showServiceErrorNotification,
  showServiceInstallNotification,
} from './notifications.js';
import { settingsManager } from './settings-manager.js';

/**
 * Service manager - handles lifecycle of all services
 */
export class ServiceManager {
  /**
   * Create a new ServiceManager instance
   */
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
    await this.ensureServicesPath();

    for (const serviceConfig of config.services) {
      await this.initializeService(serviceConfig);
    }
  }

  /**
   * Ensure services path exists and is selected
   */
  async ensureServicesPath() {
    const needsPath = !settings.hasSync('path') || !fs.existsSync(this.servicesPath);

    if (!needsPath) return;

    // Create default directory first and remember it for potential cleanup
    const defaultPath = this.servicesPath;
    fs.mkdirSync(defaultPath, { recursive: true });

    try {
      // Ask user to confirm or change the services directory
      await this.selectServicesPath();

      // If the user chose a different path, clean up the initially created default folder
      if (this.servicesPath !== defaultPath) {
        this.cleanupEmptyDirectory(defaultPath);
      }
    } catch {
      // User cancelled - clean up and exit
      this.cleanupEmptyDirectory(defaultPath);
      throw new Error('User canceled directory selection');
    }
  }

  /**
   * Prompt user to select services directory
   * @throws {Error} If user cancels directory selection
   */
  async selectServicesPath() {
    const result = await dialog.showOpenDialog({
      title: 'Choose Services Folder',
      defaultPath: this.servicesPath,
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths?.length) {
      throw new Error('User canceled directory selection');
    }

    this.servicesPath = result.filePaths[0];
    settings.setSync('path', this.servicesPath);
  }

  /**
   * Initialize a single service
   */
  async initializeService(serviceConfig) {
    if (serviceConfig.executable) {
      const service = createService(serviceConfig);
      this.services.set(serviceConfig.id, service);

      // Kill any existing processes to ensure clean start
      if (await service.isProcessRunning()) {
        await this.forceKillProcess(serviceConfig.executable);
      }
    }

    await this.ensureServiceUpToDate(serviceConfig);

    // Set up process monitoring for executable services
    if (serviceConfig.executable) {
      this.setupExitCallback(serviceConfig.id);
    }
  }

  /**
   * Ensure service is up to date, install if missing or outdated
   * @param {Object} serviceConfig - Service configuration object from config.services
   */
  async ensureServiceUpToDate(serviceConfig) {
    const installedVersion = settings.getSync(`version.${serviceConfig.id}`);
    const servicePath = path.join(this.servicesPath, serviceConfig.id);
    const serviceExists = fs.existsSync(servicePath);

    const needsUpdate =
      !installedVersion || !serviceExists || semverGt(serviceConfig.version, installedVersion);

    if (needsUpdate) {
      await this.updateService(serviceConfig, !serviceExists);
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
        serviceConfig.version,
        isFirstInstall
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

      settings.setSync(`version.${serviceConfig.id}`, serviceConfig.version);
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
   * Start all services
   */
  async startAll() {
    const promises = [...this.services.keys()].map(id =>
      this.startService(id).catch(error => logger.error(`Failed to start service ${id}`, error))
    );
    await Promise.allSettled(promises);
  }

  /**
   * Show ready notification if enabled
   */
  showReadyNotificationIfEnabled() {
    if (settingsManager.getShowReadyNotification()) {
      showReadyNotification();
    }
  }

  /**
   * Stop all services and cleanup
   */
  async stopAll() {
    const promises = [...this.services.keys()].map(id =>
      this.stopService(id).catch(error => logger.error(`Failed to stop service ${id}`, error))
    );
    await Promise.allSettled(promises);
  }

  /**
   * Start a specific service by ID
   * @param {string} id - Service identifier
   */
  async startService(id) {
    const service = this.services.get(id);
    if (!service) return;

    await service.start();
    this.setupExitCallback(id);
    this.setupConfigWatcher(id);
    updateServiceMenuItems(id);
  }

  /**
   * Stop a specific service by ID
   * @param {string} id - Service identifier
   */
  async stopService(id) {
    const service = this.services.get(id);
    if (!service) return;

    await service.stop();
    this.cleanupConfigWatcher(id);
    updateServiceMenuItems(id);
  }

  /**
   * Restart a specific service by ID
   * @param {string} id - Service identifier
   */
  async restartService(id) {
    const service = this.services.get(id);
    if (!service) return;
    try {
      await service.restart();
    } catch (error) {
      logger.error(`Failed to restart ${id}`, error);
      showRestartFailedNotification(service.name, error.message);
    } finally {
      updateServiceMenuItems(id);
    }
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
   * Setup configuration file watcher for a specific service
   */
  setupConfigWatcher(serviceId) {
    const serviceConfig = config.services.find(s => s.id === serviceId);
    if (!serviceConfig?.configFile) return;

    const configPath = path.join(this.servicesPath, serviceId, serviceConfig.configFile);
    if (!fs.existsSync(configPath)) return;

    const initialHash = this.getFileHash(configPath);
    if (initialHash) {
      this.configHashes.set(serviceId, initialHash);
    }

    const watcher = fs.watch(configPath, () => {
      clearTimeout(this.debounceTimeouts.get(serviceId));
      this.debounceTimeouts.set(
        serviceId,
        setTimeout(() => this.handleConfigChange(serviceId, configPath), config.watcher.debounce)
      );
    });

    this.configWatchers.set(serviceId, watcher);
  }

  /**
   * Clean up config watcher for a specific service
   */
  cleanupConfigWatcher(serviceId) {
    const watcher = this.configWatchers.get(serviceId);
    if (watcher) {
      watcher.close();
      this.configWatchers.delete(serviceId);
    }

    const timeout = this.debounceTimeouts.get(serviceId);
    if (timeout) {
      clearTimeout(timeout);
      this.debounceTimeouts.delete(serviceId);
    }

    this.configHashes.delete(serviceId);
    this.restartCooldowns.delete(serviceId);
  }

  /**
   * Handle configuration file changes with cooldown and content verification
   * @param {string} serviceId - Service identifier whose config changed
   * @param {string} configPath - Full path to the changed configuration file
   */
  async handleConfigChange(serviceId, configPath) {
    const now = Date.now();
    const lastRestart = this.restartCooldowns.get(serviceId) || 0;

    // Prevent rapid restarts within cooldown period
    if (now - lastRestart < config.watcher.restartCooldown) return;

    const currentHash = this.getFileHash(configPath);
    const previousHash = this.configHashes.get(serviceId);

    // Only restart if file content actually changed (prevents false positives)
    if (!currentHash || currentHash === previousHash) return;

    this.configHashes.set(serviceId, currentHash);
    this.restartCooldowns.set(serviceId, now);

    // Only restart if service is currently running
    if (this.isServiceRunning(serviceId)) {
      await this.restartService(serviceId);
    }
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
  handleUnexpectedExit(serviceId, code, signal) {
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
   * Force kill a process by executable name
   * @param {string} executable - Executable name to kill
   */
  async forceKillProcess(executable) {
    try {
      const execute = promisify(exec);
      await execute(`taskkill /F /T /IM "${executable}" 2>nul`);
    } catch {
      // Process not found or already stopped - this is fine
    }
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

  /**
   * Clean up empty directory safely
   */
  cleanupEmptyDirectory(dirPath) {
    try {
      const files = fs.readdirSync(dirPath);
      if (files.length === 0) {
        fs.rmdirSync(dirPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

export const serviceManager = new ServiceManager();
