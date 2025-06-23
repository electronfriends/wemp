import { app, Menu, dialog } from 'electron';
import settings from 'electron-settings';
import squirrelStartup from 'electron-squirrel-startup';
import { updateElectronApp } from 'update-electron-app';

import { initializeServices, startServices, stopServices } from './core/manager';
import { createMenu, tray } from './core/menu';
import { onServicesReady } from './utils/notification';
import log from './utils/logger';

// Ensure single instance and handle squirrel startup
if (!app.requestSingleInstanceLock() || squirrelStartup) {
  app.quit();
} else {
  // Enable automatic updates
  updateElectronApp();

  // Prevent default menu
  Menu.setApplicationMenu(null);

  // Graceful shutdown handling
  app.on('before-quit', async (event) => {
    event.preventDefault();
    try {
      await stopServices();
    } catch (error) {
      log.error('Error during shutdown', error);
    }
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
    try {
      createMenu();
      await initializeServices();
      await startServices();

      // Show notification if enabled
      if (settings.getSync('showReadyNotification')) {
        onServicesReady();
      }
    } catch (error) {
      log.error('Failed to initialize application', error);
      dialog.showErrorBox(
        'Initialization Error',
        'Failed to start Wemp. Check the error logs for details.'
      );
    }
  });
}
