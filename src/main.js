import { app, Menu } from 'electron';
import settings from 'electron-settings';
import squirrelStartup from 'electron-squirrel-startup';
import { updateElectronApp } from 'update-electron-app';

import { checkServices, startServices, stopServices } from './main-process/manager';
import { createMenu, tray } from './main-process/menu';
import { onServicesReady } from './utils/notification';

// Ensure single instance and handle squirrel startup
if (!app.requestSingleInstanceLock() || squirrelStartup) {
  app.quit();
} else {
  // Enable automatic updates
  updateElectronApp();

  // Prevent default menu
  Menu.setApplicationMenu(null);

  // Stop services before quitting
  app.on('before-quit', async (event) => {
    event.preventDefault();
    await stopServices();
    app.exit();
  });

  // Focus tray and open context menu on second instance
  app.on('second-instance', () => {
    if (tray) {
      tray.popUpContextMenu();
    }
  });

  // Initialize app when ready
  app.whenReady().then(async () => {
    createMenu();
    await checkServices();
    await startServices();

    // Show notification if enabled
    if (settings.getSync('showReadyNotification')) {
      onServicesReady();
    }

    // Update autostart settings in production
    if (app.isPackaged) {
      const loginItemSettings = app.getLoginItemSettings();
      if (loginItemSettings.openAtLogin && loginItemSettings.path !== process.execPath) {
        app.setLoginItemSettings({
          openAtLogin: true,
          path: process.execPath
        });
      }
    }
  });
}
