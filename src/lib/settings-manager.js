import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { app } from 'electron';
import settings from 'electron-settings';

import config from '../config.js';

const execute = promisify(exec);

/**
 * Settings manager for application preferences
 */
export class SettingsManager {
  /**
   * Initialize settings manager and migrate old settings
   */
  constructor() {
    this.migrateSettings();
  }

  /**
   * Migrate old settings format to new single-path format
   */
  migrateSettings() {
    const paths = settings.getSync('paths');
    if (paths && typeof paths === 'object') {
      const currentPath = settings.getSync('path');
      const pathKeys = Object.keys(paths);
      const pathToUse = currentPath || pathKeys[0];

      if (pathToUse && pathKeys.length > 0) {
        if (!currentPath) {
          settings.setSync('path', pathToUse);
        }

        const versions = paths[pathToUse];
        if (versions && typeof versions === 'object') {
          Object.entries(versions).forEach(([serviceId, version]) => {
            settings.setSync(`version.${serviceId}`, version);
          });
        }
      }

      settings.unsetSync('paths');
    }

    if (settings.has('showReadyNotification')) {
      settings.unsetSync('showReadyNotification');
    }
  }

  /**
   * Get autostart setting
   * @returns {boolean}
   */
  getAutostart() {
    if (!app.isPackaged) return false;
    return app.getLoginItemSettings().openAtLogin;
  }

  /**
   * Set autostart setting
   * @param {boolean} enabled
   */
  async setAutostart(enabled) {
    if (!app.isPackaged) return;

    // Use Squirrel updater for proper auto-start support
    const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
    const exeName = path.basename(process.execPath);

    if (enabled) {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        path: updateExe,
        args: ['--processStart', exeName],
      });
    } else {
      app.setLoginItemSettings({
        openAtLogin: false,
        path: updateExe,
        args: ['--processStart', exeName],
      });
    }
  }

  /**
   * Check if a service is in PATH by trying to find its executable
   * @param {string} serviceId - Service identifier (nginx, mariadb, php)
   * @returns {Promise<boolean>}
   */
  async isServiceInPath(serviceId) {
    try {
      const service = config.services.find(s => s.id === serviceId);
      if (!service?.executable) return false;

      await execute(`where ${service.executable}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get service directory path for PATH management
   * @param {string} serviceId
   * @returns {string}
   */
  getServicePath(serviceId) {
    const service = config.services.find(s => s.id === serviceId);
    const executablePath = service?.executablePath || '';
    return path.join(config.paths.services, serviceId, executablePath);
  }

  /**
   * Add or remove a service from PATH using PowerShell
   * @param {string} serviceId - Service identifier
   * @param {boolean} enabled - Whether to add or remove from PATH
   */
  async setServiceInPath(serviceId, enabled) {
    try {
      const servicePath = this.getServicePath(serviceId);

      if (enabled) {
        const addCommand = `powershell -Command "$env:PATH += ';${servicePath}'; [Environment]::SetEnvironmentVariable('PATH', $env:PATH, [EnvironmentVariableTarget]::User)"`;
        await execute(addCommand);
      } else {
        const removeCommand = `powershell -Command "$newPath = ($env:PATH -split ';' | Where-Object { $_ -ne '${servicePath}' }) -join ';'; [Environment]::SetEnvironmentVariable('PATH', $newPath, [EnvironmentVariableTarget]::User)"`;
        await execute(removeCommand);
      }
    } catch (error) {
      throw new Error(
        `Failed to ${enabled ? 'add' : 'remove'} ${serviceId} ${enabled ? 'to' : 'from'} PATH: ${error.message}`
      );
    }
  }

  /**
   * Get PATH settings for all services by checking actual PATH
   * @returns {Promise<Object<string, boolean>>}
   */
  async getPathSettings() {
    const pathSettings = {};
    const executableServices = config.services.filter(service => service.executable);

    for (const service of executableServices) {
      pathSettings[service.id] = await this.isServiceInPath(service.id);
    }

    return pathSettings;
  }
}

export const settingsManager = new SettingsManager();
