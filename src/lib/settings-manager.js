import path from 'node:path';

import { app } from 'electron';
import settings from 'electron-settings';

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
  }

  /**
   * Get autostart setting
   * @returns {boolean}
   */
  getAutostart() {
    if (!app.isPackaged) return false;

    const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
    const exeName = path.basename(process.execPath);

    const { openAtLogin } = app.getLoginItemSettings({
      path: updateExe,
      args: ['--processStart', exeName],
    });
    return openAtLogin;
  }

  /**
   * Set autostart setting
   * @param {boolean} enabled
   */
  setAutostart(enabled) {
    if (!app.isPackaged) return;

    // Use Squirrel updater for proper auto-start support
    const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
    const exeName = path.basename(process.execPath);

    if (enabled) {
      app.setLoginItemSettings({
        openAtLogin: true,
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
   * Get show ready notification setting
   * @returns {boolean}
   */
  getShowReadyNotification() {
    return settings.getSync('showReadyNotification') || false;
  }

  /**
   * Set show ready notification setting
   * @param {boolean} enabled
   */
  setShowReadyNotification(enabled) {
    settings.setSync('showReadyNotification', enabled);
  }
}

export const settingsManager = new SettingsManager();
