import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { dialog } from 'electron';
import settings from 'electron-settings';

import config from '../config.js';
import logger from './logger.js';

/**
 * Manages service installation and directory setup
 *
 * Handles initial service path selection, directory setup, and installation
 * of missing services. Coordinates with version manager to determine what needs installation.
 */
export class ServiceInstaller {
  /**
   * Creates a new ServiceInstaller instance
   * @param {VersionManager} versionManager - Version manager for checking installation status
   */
  constructor(versionManager) {
    /** @type {VersionManager} Version manager for checking installation status */
    this.versionManager = versionManager;
  }

  /**
   * Ensures the services directory exists and is properly configured.
   * Prompts user to select a directory if not already configured.
   * @returns {Promise<void>}
   * @throws {Error} If user cancels directory selection
   */
  async ensureServicesPath() {
    // Skip dialog if path already configured and valid
    if (settings.hasSync('path') && fs.existsSync(config.paths.services)) {
      return;
    }

    // Create default path as starting point for folder picker
    const defaultPath = config.paths.services;
    fs.mkdirSync(defaultPath, { recursive: true });

    try {
      await this.selectServicesPath();
      // Clean up default path if user chose a different location
      if (config.paths.services !== defaultPath) {
        await this.cleanupEmptyDirectory(defaultPath);
      }
    } catch (error) {
      // User canceled directory selection
      await this.cleanupEmptyDirectory(defaultPath);
      throw error;
    }
  }

  /**
   * Checks and installs any missing services
   * @returns {Promise<void>}
   */
  async ensureServicesInstalled() {
    const missingServices = this.versionManager.getServicesNotInstalled();
    if (!missingServices.length) return;

    logger.info(`Installing missing services: ${missingServices.join(', ')}`);

    // Install each missing service sequentially
    for (const serviceId of missingServices) {
      try {
        await this.installService(serviceId);
      } catch (error) {
        const serviceName = config.services[serviceId]?.name || serviceId;
        logger.error(`Failed to install ${serviceName}:`, error);
      }
    }
  }

  /**
   * Installs a single service
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   * @throws {Error} If service unknown or installation fails
   */
  async installService(serviceId) {
    if (!config.services[serviceId]) {
      throw new Error(`Unknown service: ${serviceId}`);
    }
    await this.versionManager.installService(serviceId);
  }

  /**
   * Performs initial MariaDB database setup and configuration
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initializeMariaDB() {
    const servicePath = path.join(config.paths.services, 'mariadb');
    const dataPath = path.join(servicePath, 'data');
    const installDbPath = path.join(servicePath, 'bin', 'mysql_install_db.exe');

    // Check if already initialized or installer missing
    if (fs.existsSync(dataPath) && fs.readdirSync(dataPath).length > 0) {
      logger.info('MariaDB already initialized, skipping...');
      return;
    }

    if (!fs.existsSync(installDbPath)) {
      logger.warn(`mysql_install_db.exe not found at ${installDbPath}`);
      return;
    }

    logger.info('Initializing MariaDB database...');
    fs.mkdirSync(dataPath, { recursive: true });

    try {
      await this.runMariaDBInstaller(installDbPath, dataPath, servicePath);
      logger.info('MariaDB initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MariaDB', error);
      throw error;
    }
  }

  /**
   * Prompts user to select services directory
   * @returns {Promise<void>}
   * @throws {Error} If user cancels selection
   * @private
   */
  async selectServicesPath() {
    const result = await dialog.showOpenDialog({
      title: 'Choose Services Folder',
      defaultPath: config.paths.services,
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths?.length) {
      throw new Error('User canceled directory selection');
    }

    settings.setSync('path', result.filePaths[0]);
  }

  /**
   * Runs the MariaDB installer
   * @param {string} installDbPath - Path to mysql_install_db.exe
   * @param {string} dataPath - Path for database data directory
   * @param {string} servicePath - MariaDB installation path
   * @returns {Promise<void>}
   * @throws {Error} If installation fails
   * @private
   */
  runMariaDBInstaller(installDbPath, dataPath, servicePath) {
    return new Promise((resolve, reject) => {
      const installProcess = spawn(installDbPath, [`--datadir=${dataPath}`, '--password='], {
        cwd: servicePath,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stderr = '';

      installProcess.stdout?.on('data', data =>
        logger.info(`mysql_install_db stdout: ${data.toString().trim()}`)
      );

      installProcess.stderr?.on('data', data => {
        stderr += data.toString();
        logger.info(`mysql_install_db stderr: ${data.toString().trim()}`);
      });

      installProcess.on('exit', code =>
        code === 0
          ? resolve()
          : reject(new Error(`MariaDB initialization failed with code ${code}. stderr: ${stderr}`))
      );

      installProcess.on('error', reject);
    });
  }

  /**
   * Cleans up empty directories
   * @param {string} dirPath - Directory path to clean
   * @returns {Promise<void>}
   * @private
   */
  async cleanupEmptyDirectory(dirPath) {
    try {
      if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
        fs.rmdirSync(dirPath);
        logger.info(`Cleaned up empty directory: ${dirPath}`);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup directory ${dirPath}:`, error);
    }
  }
}
