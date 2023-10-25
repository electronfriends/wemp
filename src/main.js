import { app, autoUpdater, Menu } from 'electron';
import settings from 'electron-settings';

import { createMenu, tray } from './main-process/menu';
import { checkServices, startServices, stopServices } from './main-process/manager';
import { onServicesReady } from './utils/notification';

// Try to acquire a single instance lock.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Handle creating/removing shortcuts on Windows when installing/uninstalling.
  if (require('electron-squirrel-startup')) {
    app.quit();
  }

  // Enable automatic updates for the app.
  require('update-electron-app')();

  // Prevent Electron from setting a default menu.
  Menu.setApplicationMenu(null);

  // Handle the ready event to start the services and create the menu.
  app.on('ready', async () => {
    createMenu();
    await checkServices();
    await startServices();

    if (settings.getSync('showReadyNotification')) {
      onServicesReady();
    }

    // Check if a temporary setting for 'open at login' is set, and update login settings.
    if (settings.hasSync('tempOpenAtLogin')) {
      const tempOpenAtLogin = settings.getSync('tempOpenAtLogin');
      if (tempOpenAtLogin) {
        app.setLoginItemSettings({ openAtLogin: true });
      }
      settings.unsetSync('tempOpenAtLogin');
    }
  });

  // Handle the before-quit event to stop services before quitting.
  app.on('before-quit', async (event) => {
    event.preventDefault();
    await stopServices();
    app.exit();
  });

  // Handle the second-instance event to focus the tray and open the context menu.
  app.on('second-instance', () => {
    if (tray) {
      tray.focus();
      tray.popUpContextMenu();
    }
  });

  // If 'open at login' is enabled when an update is downloaded, temporarily disable it.
  // We will have to manually apply it to the new version.
  autoUpdater.on('update-downloaded', () => {
    const loginItemSettings = app.getLoginItemSettings();
    if (loginItemSettings.openAtLogin) {
      app.setLoginItemSettings({ openAtLogin: false });
      settings.setSync('tempOpenAtLogin', true);
    }
  });
}
