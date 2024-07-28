import { app, Menu } from 'electron/main';
import settings from 'electron-settings';
import squirrelStartup from 'electron-squirrel-startup';
import { updateElectronApp } from 'update-electron-app';

import { createMenu, tray } from './main-process/menu';
import { checkServices, startServices, stopServices } from './main-process/manager';
import { onServicesReady } from './utils/notification';

// Try to acquire a single instance lock and handle squirrel startup.
if (!app.requestSingleInstanceLock() || squirrelStartup) {
  app.quit();
} else {
  // Enable automatic updates for the app.
  updateElectronApp();

  // Prevent Electron from setting a default menu.
  Menu.setApplicationMenu(null);

  // Handle the before-quit event to stop services before quitting.
  app.on('before-quit', async (event) => {
    event.preventDefault();
    await stopServices();
    app.exit();
  });

  // Handle the second-instance event to focus the tray and open the context menu.
  app.on('second-instance', () => {
    if (tray) {
      tray.popUpContextMenu();
    }
  });

  // Handle the ready event to start the services and create the menu.
  app.whenReady().then(async () => {
    createMenu();
    await checkServices();
    await startServices();
    if (settings.getSync('showReadyNotification')) {
      onServicesReady();
    }
  });
}
