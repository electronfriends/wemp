import fs from 'node:fs';
import path from 'node:path';

import settings from 'electron-settings';

import { fetchServiceVersions } from './api-client.js';
import config from '../config.js';
import { downloadService } from './downloader.js';
import logger from './logger.js';
import * as notifications from './notifications.js';

/**
 * Compare two version strings (e.g., "1.2.3" vs "1.2.1")
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean} True if version1 > version2
 */
function isVersionGreater(version1, version2) {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  const maxLength = Math.max(v1Parts.length, v2Parts.length);

  // Compare each version segment numerically
  for (let i = 0; i < maxLength; i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    if (v1Part !== v2Part) return v1Part > v2Part;
  }

  // Versions are equal
  return false;
}

/**
 * Manages service version tracking and updates
 *
 * Tracks installed versions, checks for updates from API, and coordinates downloads.
 * Maintains service state in memory and persists versions to settings.
 */
export class VersionManager {
  constructor() {
    /** @type {Map<string, {currentVersion: string, availableVersion: string, downloadUrl: string}>} */
    this.serviceStates = new Map();
    this.migrateLegacySettings();
  }

  /**
   * Migrates old settings format to new format
   * @private
   */
  migrateLegacySettings() {
    if (settings.hasSync('paths')) {
      settings.unsetSync('paths');
      logger.info('Removed legacy paths setting');
    }
  }

  /**
   * Checks for available service updates from API and determines installation status
   * @returns {Promise<void>}
   */
  async checkForUpdates() {
    const apiVersions = await fetchServiceVersions();
    if (!apiVersions) return;

    for (const [serviceId, serviceConfig] of Object.entries(config.services)) {
      if (!apiVersions[serviceId]) continue;

      const currentVersion = this.getCurrentVersion(serviceId);
      const { version: availableVersion, downloadUrl } = apiVersions[serviceId];

      // Log update availability
      if (currentVersion !== '0.0.0' && isVersionGreater(availableVersion, currentVersion)) {
        logger.info(
          `${serviceConfig.name} update available: ${currentVersion} -> ${availableVersion}`
        );
      }

      this.serviceStates.set(serviceId, { currentVersion, availableVersion, downloadUrl });
    }

    // Log summary
    const updateCount = this.getServicesNeedingUpdate().length;
    const installedCount = Array.from(this.serviceStates.values()).filter(
      s => s.currentVersion !== '0.0.0'
    ).length;

    if (updateCount === 0 && installedCount > 0) {
      logger.info('All installed services are up to date');
    }
  }

  /**
   * Checks if service is actually installed on disk
   * @param {string} serviceId - Service identifier
   * @returns {boolean} True if service is installed
   * @private
   */
  isServiceInstalled(serviceId) {
    const servicePath = path.join(config.paths.services, serviceId);
    if (!fs.existsSync(servicePath)) return false;

    try {
      return fs.readdirSync(servicePath).length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Gets the current installed version for a service
   * Checks both settings and actual installation on disk for consistency
   * @param {string} serviceId - Service identifier
   * @returns {string} Current version or '0.0.0' if not installed
   */
  getCurrentVersion(serviceId) {
    const settingsVersion = settings.getSync(`version.${serviceId}`) || '0.0.0';
    const isInstalled = this.isServiceInstalled(serviceId);

    // If folder doesn't exist but version is set, reset to 0.0.0
    if (!isInstalled && settingsVersion !== '0.0.0') {
      logger.warn(
        `${serviceId} has version ${settingsVersion} in settings but is not installed on disk`
      );
      return '0.0.0';
    }

    return settingsVersion;
  }

  /**
   * Gets display version (shows available version for uninstalled/needs-update)
   * @param {string} serviceId - Service identifier
   * @returns {string} Version to display in UI
   */
  getDisplayVersion(serviceId) {
    const state = this.serviceStates.get(serviceId);
    if (!state) return this.getCurrentVersion(serviceId);

    const needsUpdate =
      state.currentVersion !== '0.0.0' &&
      isVersionGreater(state.availableVersion, state.currentVersion);
    const isNotInstalled = state.currentVersion === '0.0.0';

    // Show available version if not installed or update available, otherwise show current
    return needsUpdate || isNotInstalled ? state.availableVersion : state.currentVersion;
  }

  /**
   * Checks if any service updates are available
   * @returns {boolean} True if updates are available
   */
  hasAvailableUpdates() {
    return Array.from(this.serviceStates.values()).some(
      state =>
        state.currentVersion !== '0.0.0' &&
        isVersionGreater(state.availableVersion, state.currentVersion)
    );
  }

  /**
   * Gets list of services needing updates
   * @returns {string[]} Array of service IDs
   */
  getServicesNeedingUpdate() {
    return Array.from(this.serviceStates.entries())
      .filter(
        ([, state]) =>
          state.currentVersion !== '0.0.0' &&
          isVersionGreater(state.availableVersion, state.currentVersion)
      )
      .map(([serviceId]) => serviceId);
  }

  /**
   * Gets list of services not installed
   * @returns {string[]} Array of service IDs
   */
  getServicesNotInstalled() {
    return Array.from(this.serviceStates.entries())
      .filter(([, state]) => state.currentVersion === '0.0.0')
      .map(([serviceId]) => serviceId);
  }

  /**
   * Updates a service to the available version
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  async updateService(serviceId) {
    const state = this.serviceStates.get(serviceId);
    if (!state) {
      throw new Error(`No state information found for ${serviceId}`);
    }

    const serviceConfig = config.services[serviceId];
    const isFirstInstall = state.currentVersion === '0.0.0';

    const notification = isFirstInstall
      ? notifications.showServiceInstalling(serviceConfig.name, state.availableVersion)
      : notifications.showServiceUpdating(serviceConfig.name, state.availableVersion);

    try {
      // Download using the version and URL from API
      await downloadService({
        ...serviceConfig,
        id: serviceId,
        version: state.availableVersion,
        downloadUrl: state.downloadUrl,
      });

      // Persist version to settings for future reference
      settings.setSync(`version.${serviceId}`, state.availableVersion);

      // Update in-memory state to reflect installation
      this.serviceStates.set(serviceId, {
        ...state,
        currentVersion: state.availableVersion,
      });

      notification.close();

      logger.info(
        `${isFirstInstall ? 'Installed' : 'Updated'} ${serviceConfig.name} to version ${state.availableVersion}`
      );
    } catch (error) {
      notification.close();
      throw error;
    }
  }

  /**
   * Installs a service (alias for updateService for consistency)
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  async installService(serviceId) {
    return this.updateService(serviceId);
  }
}
