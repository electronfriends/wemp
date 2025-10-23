import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';

import config from '../config.js';
import logger from './logger.js';

/**
 * Monitors service configuration files for changes
 *
 * Uses file watching and MD5 hashing to detect actual content changes in configuration files.
 * Emits events when configuration changes are detected to trigger service restarts.
 *
 * @fires ConfigWatcher#config-changed
 */
export class ConfigWatcher extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, string>} Maps service ID to config file path */
    this.watchers = new Map();
    /** @type {Map<string, string>} Maps service ID to file content hash */
    this.hashes = new Map();
  }

  /**
   * Sets up configuration file watching for a service
   * @param {string} serviceId - Service identifier
   * @param {string} servicePath - Path to service installation
   */
  setupWatcher(serviceId, servicePath) {
    const serviceConfig = config.services[serviceId];
    if (!serviceConfig.configFile) return;

    const configPath = path.join(servicePath, serviceConfig.configFile);
    if (!fs.existsSync(configPath)) {
      logger.warn(`Config file does not exist for ${serviceId}: ${configPath}`);
      return;
    }

    // Baseline for detecting actual content changes
    const initialHash = this.getFileHash(configPath);
    this.hashes.set(serviceId, initialHash);

    // Monitor for configuration file changes
    fs.watchFile(configPath, { interval: config.watcher.pollInterval }, () => {
      this.handleConfigFileChange(serviceId, configPath);
    });

    this.watchers.set(serviceId, configPath);
  }

  /**
   * Removes configuration file watcher for a service
   * @param {string} serviceId - Service identifier
   */
  removeWatcher(serviceId) {
    const configPath = this.watchers.get(serviceId);
    if (configPath) {
      fs.unwatchFile(configPath);
      this.watchers.delete(serviceId);
      this.hashes.delete(serviceId);
    }
  }

  /**
   * Removes all configuration file watchers
   */
  removeAllWatchers() {
    for (const serviceId of this.watchers.keys()) {
      this.removeWatcher(serviceId);
    }
  }

  /**
   * Handles configuration file changes
   * @param {string} serviceId - Service identifier
   * @param {string} configPath - Path to configuration file
   * @private
   */
  handleConfigFileChange(serviceId, configPath) {
    const currentHash = this.getFileHash(configPath);
    if (currentHash === this.hashes.get(serviceId)) return;

    this.hashes.set(serviceId, currentHash);

    // Notify service manager to reload or restart
    this.emit('config-changed', serviceId);
  }

  /**
   * Gets the MD5 hash of a file for change detection
   * @param {string} filePath - Path to file
   * @returns {string} MD5 hash
   * @private
   */
  getFileHash(filePath) {
    try {
      const content = fs.readFileSync(filePath);
      return createHash('md5').update(content).digest('hex');
    } catch (error) {
      logger.warn(`Failed to hash config file ${filePath}:`, error.message);
      return '';
    }
  }
}
