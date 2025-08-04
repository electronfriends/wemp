import { Menu, app, dialog } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { updateElectronApp } from 'update-electron-app';

import { createMenu, tray } from './lib/menu.js';
import { serviceManager } from './lib/service-manager.js';
import logger from './lib/logger.js';

// Handle single instance and squirrel startup
if (!app.requestSingleInstanceLock() || squirrelStartup) {
  app.quit();
} else {
  // Enable auto-updates
  updateElectronApp();

  // Remove default menu
  Menu.setApplicationMenu(null);

  // Handle second instance
  app.on('second-instance', () => {
    if (tray) {
      tray.popUpContextMenu();
    }
  });

  // Handle shutdown
  app.on('before-quit', async event => {
    event.preventDefault();
    try {
      await serviceManager.stopAll();
    } catch (error) {
      logger.error('Error during shutdown', error);
    }
    app.exit();
  });

  // Initialize when ready
  app.whenReady().then(async () => {
    try {
      await createMenu();
      await serviceManager.init();
    } catch (error) {
      logger.error('Failed to initialize application', error);

      await dialog.showMessageBox({
        type: 'error',
        title: 'Initialization Error',
        message: 'Failed to initialize the application',
        detail: error.message,
        buttons: ['Exit'],
      });

      app.quit();
    }
  });
}
