import { spawn, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';

import settings from 'electron-settings';

import config from '../config.js';
import { fetchServiceVersions } from './api-client.js';
import { downloadService } from './downloader.js';
import logger from './logger.js';
import * as notifications from './notifications.js';

/**
 * Compares two semantic version strings
 * @param {string} version1 - First version (e.g., "1.2.3")
 * @param {string} version2 - Second version (e.g., "1.2.1")
 * @returns {boolean} True if version1 is greater than version2
 * @private
 */
function isVersionGreater(version1, version2) {
  if (!version1 || !version2) return false;

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
 *
 * @extends EventEmitter
 * @fires VersionManager#version-changed - Emitted when a service version changes
 */
export class VersionManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, {currentVersion: string, availableVersion: string, downloadUrl: string}>} */
    this.serviceStates = new Map();
    this.migrateLegacySettings();
    this.scanAndSyncInstalledVersions();
  }

  /**
   * Migrates old settings format to new structured format
   * @private
   */
  migrateLegacySettings() {
    if (settings.hasSync('paths')) {
      settings.unsetSync('paths');
      logger.info('Removed legacy paths setting');
    }
  }

  /**
   * Scans disk for version directories and syncs installedVersions in settings
   * @private
   */
  scanAndSyncInstalledVersions() {
    const installedVersions = settings.getSync('installedVersions') || {};
    let hasChanges = false;

    for (const serviceId of Object.keys(config.services)) {
      const storedVersions = installedVersions[serviceId] || [];
      const foundVersions = new Set();

      try {
        const servicesDir = config.paths.services;
        if (!fs.existsSync(servicesDir)) continue;

        const entries = fs.readdirSync(servicesDir);

        // Find version directories on disk
        for (const entry of entries) {
          const match = entry.match(new RegExp(`^${serviceId}-(\\d+)\\.(\\d+)$`));
          if (!match) continue;

          const dirPath = path.join(servicesDir, entry);
          if (!fs.statSync(dirPath).isDirectory()) continue;

          const major = match[1];
          const minor = match[2];

          // Find matching version in stored list
          const matchingVersion = storedVersions.find(v => v.startsWith(`${major}.${minor}.`));
          if (matchingVersion) {
            foundVersions.add(matchingVersion);
          }
        }
      } catch (error) {
        logger.warn(`Failed to scan for ${serviceId} versions:`, error);
      }

      const finalVersions = Array.from(foundVersions).sort((a, b) => {
        const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
        const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
        return bMajor - aMajor || bMinor - aMinor || bPatch - aPatch;
      });

      if (finalVersions.length > 0) {
        if (JSON.stringify(installedVersions[serviceId]) !== JSON.stringify(finalVersions)) {
          installedVersions[serviceId] = finalVersions;
          hasChanges = true;
          logger.info(`Synced ${serviceId} versions: ${finalVersions.join(', ')}`);
        }
      } else if (installedVersions[serviceId]) {
        delete installedVersions[serviceId];
        hasChanges = true;
        logger.info(`Removed ${serviceId} from installed versions`);
      }
    }

    if (hasChanges) {
      settings.setSync('installedVersions', installedVersions);
    }
  }

  /**
   * Checks for available service updates from API and determines installation status
   * @returns {Promise<void>}
   */
  async checkForUpdates() {
    const apiVersions = await fetchServiceVersions();

    // Fallback to installed versions if API is unreachable
    if (!apiVersions) {
      logger.warn('API unavailable, using installed versions only');
      const installedVersions = settings.getSync('installedVersions') || {};

      for (const [serviceId, versions] of Object.entries(installedVersions)) {
        if (Array.isArray(versions) && versions.length > 0) {
          const currentVersion = settings.getSync(`version.${serviceId}`) || versions[0];
          this.serviceStates.set(serviceId, {
            multiVersion: true,
            currentVersion,
            availableVersion: versions[0],
            downloadUrl: '',
            availableVersions: versions.map(v => ({
              version: v,
              downloadUrl: '',
              installed: true,
              deprecated: false,
            })),
          });
        }
      }
      return;
    }

    for (const [serviceId, serviceConfig] of Object.entries(config.services)) {
      if (!apiVersions[serviceId]) continue;

      const apiData = apiVersions[serviceId];
      const currentVersion = this.getCurrentVersion(serviceId);

      if (apiData.versions && Array.isArray(apiData.versions)) {
        const firstVersion = apiData.versions[0];

        // Merge API versions with installed versions
        const installedVersions = this.getInstalledVersions(serviceId);
        const allVersions = new Map();

        apiData.versions.forEach(v => {
          allVersions.set(v.version, { ...v, installed: installedVersions.includes(v.version) });
        });

        // Mark installed-only versions as deprecated
        installedVersions.forEach(v => {
          if (!allVersions.has(v)) {
            allVersions.set(v, { version: v, downloadUrl: '', installed: true, deprecated: true });
          }
        });

        this.serviceStates.set(serviceId, {
          multiVersion: true,
          currentVersion,
          availableVersion: firstVersion.version,
          downloadUrl: firstVersion.downloadUrl,
          availableVersions: Array.from(allVersions.values()),
        });

        continue;
      }

      const { version: availableVersion, downloadUrl } = apiData;

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
   * Checks if service directory exists and has content
   * @param {string} serviceId - Service identifier
   * @returns {boolean} True if service is installed
   * @private
   */
  isServiceInstalled(serviceId) {
    const servicePath = path.join(config.paths.services, serviceId);
    try {
      return fs.existsSync(servicePath) && fs.readdirSync(servicePath).length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Checks if the junction for a multi-version service is valid
   * @param {string} serviceId - Service identifier
   * @param {string} version - Expected version
   * @returns {boolean} True if junction points to correct version
   * @private
   */
  isJunctionValid(serviceId, version) {
    const servicePath = path.join(config.paths.services, serviceId);
    const [major, minor] = version.split('.');
    const expectedTarget = path.join(config.paths.services, `${serviceId}-${major}.${minor}`);

    try {
      const stats = fs.lstatSync(servicePath);
      if (!stats.isSymbolicLink()) return false;

      const target = fs.readlinkSync(servicePath);
      return path.resolve(target) === path.resolve(expectedTarget);
    } catch {
      return false;
    }
  }

  /**
   * Gets the currently selected version for a service
   * @param {string} serviceId - Service identifier
   * @returns {string} Current version or '0.0.0' if not installed
   */
  getCurrentVersion(serviceId) {
    const settingsVersion = settings.getSync(`version.${serviceId}`);
    const serviceState = this.serviceStates.get(serviceId);
    const installedVersions = settings.getSync(`installedVersions.${serviceId}`);
    const isMultiVersion =
      serviceState?.multiVersion ||
      (Array.isArray(installedVersions) && installedVersions.length > 0);

    if (isMultiVersion) {
      const versions = this.getInstalledVersions(serviceId);

      // Determine target version: use selected if available, else first installed
      const targetVersion =
        settingsVersion && versions.includes(settingsVersion) ? settingsVersion : versions[0];

      if (!targetVersion) return '0.0.0';

      if (settingsVersion !== targetVersion) {
        settings.setSync(`version.${serviceId}`, targetVersion);
      }

      return targetVersion;
    }

    // Single-version services
    const version = settingsVersion || '0.0.0';
    return this.isServiceInstalled(serviceId) ? version : '0.0.0';
  }

  /**
   * Ensures the junction for a multi-version service is valid
   * @param {string} serviceId - Service identifier
   * @returns {boolean} True if junction is valid or was created successfully
   */
  ensureJunction(serviceId) {
    const version = this.getCurrentVersion(serviceId);
    if (version === '0.0.0') return false;

    // Single-version services don't use junctions
    const installedVersions = settings.getSync(`installedVersions.${serviceId}`);
    if (!Array.isArray(installedVersions) || installedVersions.length === 0) return true;

    if (this.isJunctionValid(serviceId, version)) return true;

    const [major, minor] = version.split('.');
    const versionId = `${serviceId}-${major}.${minor}`;

    try {
      this.updateServiceJunction(serviceId, versionId, true);
      return true;
    } catch (error) {
      logger.error(`Failed to setup junction for ${serviceId}:`, error);
      return false;
    }
  }

  /**
   * Gets array of installed versions for multi-version services
   * @param {string} serviceId - Service identifier
   * @returns {string[]} Array of installed versions
   */
  getInstalledVersions(serviceId) {
    const settingsVersions = settings.getSync(`installedVersions.${serviceId}`);
    const storedVersions = Array.isArray(settingsVersions) ? settingsVersions : [];

    // If no installedVersions entry, treat as single-version service
    if (storedVersions.length === 0) {
      // Check if single service directory exists
      const singlePath = path.join(config.paths.services, serviceId);
      if (fs.existsSync(singlePath)) {
        const version = settings.getSync(`version.${serviceId}`);
        return version ? [version] : [];
      }
      return [];
    }

    // Validate multi-version directories against actual disk state
    const validVersions = storedVersions.filter(version => {
      const [major, minor] = version.split('.');
      const versionPath = path.join(config.paths.services, `${serviceId}-${major}.${minor}`);
      return fs.existsSync(versionPath);
    });

    // Sync settings if mismatch found
    if (validVersions.length !== storedVersions.length) {
      logger.info(`Syncing ${serviceId} installed versions: ${validVersions.join(', ')}`);
      settings.setSync(`installedVersions.${serviceId}`, validVersions);
    }

    return validVersions;
  }

  /**
   * Adds version to installed versions array (for multi-version services)
   * @param {string} serviceId - Service identifier
   * @param {string} version - Version to add
   * @private
   */
  addInstalledVersion(serviceId, version) {
    const installed = settings.getSync(`installedVersions.${serviceId}`) || [];
    if (!installed.includes(version)) {
      installed.push(version);
      settings.setSync(`installedVersions.${serviceId}`, installed);
    }
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
    return Array.from(this.serviceStates.entries()).some(([, state]) => {
      if (state.multiVersion) return false;
      if (state.currentVersion === '0.0.0') return false;
      return isVersionGreater(state.availableVersion, state.currentVersion);
    });
  }

  /**
   * Gets list of services needing updates
   * @returns {string[]} Array of service IDs
   */
  getServicesNeedingUpdate() {
    return Array.from(this.serviceStates.entries())
      .filter(([, state]) => {
        if (state.multiVersion) return false;
        if (state.currentVersion === '0.0.0') return false;
        return isVersionGreater(state.availableVersion, state.currentVersion);
      })
      .map(([serviceId]) => serviceId);
  }

  /**
   * Gets list of services not installed
   * @returns {string[]} Array of service IDs
   */
  getServicesNotInstalled() {
    return Array.from(this.serviceStates.entries())
      .filter(([, state]) => !state.multiVersion && state.currentVersion === '0.0.0')
      .map(([serviceId]) => serviceId);
  }

  /**
   * Switches service to a different version (generic method for any multi-version service)
   * @param {string} serviceId - Service identifier
   * @param {string} targetVersion - Version to switch to
   * @returns {Promise<void>}
   */
  async switchServiceVersion(serviceId, targetVersion) {
    const serviceState = this.serviceStates.get(serviceId);
    const serviceConfig = config.services[serviceId];

    if (!serviceState || !serviceState.multiVersion) {
      throw new Error(`${serviceConfig.name} does not support multiple versions`);
    }

    const [major, minor] = targetVersion.split('.');
    const versionId = `${serviceId}-${major}.${minor}`;
    const versionPath = path.join(config.paths.services, versionId);

    logger.info(`Switching ${serviceConfig.name} to ${targetVersion}`);

    const isInstalled = fs.existsSync(versionPath);
    const installedVersions = this.getInstalledVersions(serviceId);

    // Check if switching to an already installed version
    if (installedVersions.includes(targetVersion)) {
      if (!isInstalled) {
        throw new Error(
          `${serviceConfig.name} ${targetVersion} is tracked but directory not found`
        );
      }
      logger.info(`Switching to already installed version ${targetVersion}`);
    } else {
      // Need to download - find in API versions
      const versionData = serviceState.availableVersions.find(v => v.version === targetVersion);
      if (!versionData || !versionData.downloadUrl) {
        throw new Error(
          `${serviceConfig.name} version ${targetVersion} is not available for download (deprecated or not in API)`
        );
      }

      logger.info(`Version ${targetVersion} not found, downloading...`);

      const notification = notifications.showServiceInstalling(serviceConfig.name, targetVersion);

      try {
        await downloadService({
          ...serviceConfig,
          id: versionId,
          version: targetVersion,
          downloadUrl: versionData.downloadUrl,
        });
      } finally {
        notification.close();
      }
    }

    await this.updateServiceJunction(serviceId, versionId);

    // Track this version as installed
    this.addInstalledVersion(serviceId, targetVersion);

    settings.setSync(`version.${serviceId}`, targetVersion);

    serviceState.currentVersion = targetVersion;
    this.serviceStates.set(serviceId, serviceState);

    logger.info(`Successfully switched to ${serviceConfig.name} ${targetVersion}`);

    this.emit('version-changed', serviceId, targetVersion);
  }

  /**
   * Removes existing service link (junction or directory)
   * @param {string} serviceId - Service identifier
   * @private
   */
  removeServiceLink(serviceId) {
    const serviceLink = path.join(config.paths.services, serviceId);

    let stats;
    try {
      stats = fs.lstatSync(serviceLink);
    } catch {
      return; // Path doesn't exist
    }

    try {
      // Remove junction/symlink
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(serviceLink);
        return;
      }

      // Handle legacy single-version directory
      if (stats.isDirectory()) {
        this.migrateLegacyServiceDirectory(serviceId, serviceLink);
      }
    } catch (err) {
      logger.warn(`Failed to remove ${serviceId} link:`, err);
      throw err;
    }
  }

  /**
   * Migrates legacy single-version directory to versioned format or removes it
   * @param {string} serviceId - Service identifier
   * @param {string} serviceLink - Path to service directory
   * @private
   */
  migrateLegacyServiceDirectory(serviceId, serviceLink) {
    const settingsVersion = settings.getSync(`version.${serviceId}`);

    // Attempt migration if we have version info
    if (settingsVersion && settingsVersion !== '0.0.0') {
      const [major, minor] = settingsVersion.split('.');
      const legacyTarget = path.join(config.paths.services, `${serviceId}-${major}.${minor}`);

      if (!fs.existsSync(legacyTarget)) {
        logger.info(`Migrating ${serviceId} ${settingsVersion} to versioned directory`);
        fs.renameSync(serviceLink, legacyTarget);
        return;
      }
    }

    // No migration possible, remove directory
    fs.rmSync(serviceLink, { recursive: true, force: true });
  }

  /**
   * Creates or updates service directory junction to point to specific version
   * @param {string} serviceId - Service identifier (e.g., 'php')
   * @param {string} versionId - Version directory name (e.g., 'php-8.4')
   * @param {boolean} sync - Whether to run synchronously (default: false)
   * @returns {Promise<void>|void}
   * @private
   */
  updateServiceJunction(serviceId, versionId, sync = false) {
    const serviceLink = path.join(config.paths.services, serviceId);
    const versionTarget = path.join(config.paths.services, versionId);

    if (sync) {
      this.removeServiceLink(serviceId);

      const result = spawnSync('cmd', ['/c', 'mklink', '/J', serviceLink, versionTarget], {
        windowsHide: true,
      });

      if (result.status === 0) {
        logger.info(`Created junction: ${serviceId} -> ${versionId}`);
      } else {
        throw new Error(
          `Failed to create junction: ${result.stderr?.toString() || 'Unknown error'}`
        );
      }
    } else {
      return new Promise((resolve, reject) => {
        try {
          this.removeServiceLink(serviceId);
        } catch (err) {
          reject(err);
          return;
        }

        const mklink = spawn('cmd', ['/c', 'mklink', '/J', serviceLink, versionTarget], {
          stdio: 'pipe',
          windowsHide: true,
        });

        let stderr = '';
        mklink.stderr?.on('data', data => {
          stderr += data.toString();
        });

        mklink.on('exit', code => {
          if (code === 0) {
            logger.info(`Created junction: ${serviceId} -> ${versionId}`);
            resolve();
          } else {
            reject(new Error(`Failed to create junction: ${stderr || 'Unknown error'}`));
          }
        });

        mklink.on('error', reject);
      });
    }
  }

  /**
   * Updates a single-version service to the latest available version.
   * For multi-version services, use switchServiceVersion() instead.
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   * @throws {Error} If service state is missing or service is multi-version
   */
  async updateService(serviceId) {
    const state = this.serviceStates.get(serviceId);
    const serviceConfig = config.services[serviceId];

    if (!state) {
      throw new Error(`No state information found for ${serviceConfig?.name ?? serviceId}`);
    }

    if (state.multiVersion) {
      throw new Error(`${serviceConfig.name} is multi-version, use switchServiceVersion() instead`);
    }

    const { availableVersion, downloadUrl } = state;
    const isFirstInstall = state.currentVersion === '0.0.0';
    const action = isFirstInstall ? 'Installing' : 'Updating';

    logger.info(`${action} ${serviceConfig.name} to ${availableVersion}`);

    const notification = isFirstInstall
      ? notifications.showServiceInstalling(serviceConfig.name, availableVersion)
      : notifications.showServiceUpdating(serviceConfig.name, availableVersion);

    try {
      await downloadService({
        ...serviceConfig,
        id: serviceId,
        version: availableVersion,
        downloadUrl,
      });

      // Update persisted version and in-memory state
      settings.setSync(`version.${serviceId}`, availableVersion);
      state.currentVersion = availableVersion;
      this.serviceStates.set(serviceId, state);

      logger.info(
        `${isFirstInstall ? 'Installed' : 'Updated'} ${serviceConfig.name} to ${availableVersion}`
      );
    } finally {
      notification.close();
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
