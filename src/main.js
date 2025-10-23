import { Menu, app, dialog } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { updateElectronApp } from 'update-electron-app';

import { createMenu, tray } from './lib/menu.js';
import logger from './lib/logger.js';
import { serviceManager } from './lib/service-manager.js';

// Handle Squirrel events and single instance lock
if (squirrelStartup || !app.requestSingleInstanceLock()) app.quit();

// Enable automatic updates for the application
updateElectronApp();

// Remove default Electron menu
Menu.setApplicationMenu(null);

// Show tray menu when second instance is launched
app.on('second-instance', () => tray?.popUpContextMenu());

// Gracefully stop all services before quit
app.on('before-quit', async event => {
  event.preventDefault();
  try {
    await serviceManager.stopAll();
  } catch (error) {
    logger.error('Error during shutdown', error);
  }
  app.exit();
});

// Initialize application when Electron is ready
app.whenReady().then(async () => {
  try {
    await serviceManager.init();
    await serviceManager.startAll();
    createMenu();
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
