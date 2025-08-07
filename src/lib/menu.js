import path from 'node:path';

import { Menu, Tray, app, shell, nativeImage, dialog } from 'electron';

import config from '../config.js';
import logger from './logger.js';
import { serviceManager } from './service-manager.js';
import { settingsManager } from './settings-manager.js';

// Load icons
import wempIcon from '../assets/wemp.png?asset';
import nginxIcon from '../assets/nginx.png?asset';
import mariadbIcon from '../assets/mariadb.png?asset';
import phpIcon from '../assets/php.png?asset';
import phpmyadminIcon from '../assets/phpmyadmin.png?asset';
import playIcon from '../assets/circled-play.png?asset';
import shutdownIcon from '../assets/shutdown.png?asset';
import restartIcon from '../assets/restart.png?asset';
import folderIcon from '../assets/folder.png?asset';
import logIcon from '../assets/event-log.png?asset';
import webIcon from '../assets/web.png?asset';
import settingsIcon from '../assets/settings.png?asset';

// Global references for the system tray and context menu
let tray;
let menu;

// Pre-loaded native images for menu icons to avoid repeated loading
const icons = {
  wemp: nativeImage.createFromDataURL(wempIcon),
  nginx: nativeImage.createFromDataURL(nginxIcon),
  mariadb: nativeImage.createFromDataURL(mariadbIcon),
  php: nativeImage.createFromDataURL(phpIcon),
  phpmyadmin: nativeImage.createFromDataURL(phpmyadminIcon),
  play: nativeImage.createFromDataURL(playIcon),
  shutdown: nativeImage.createFromDataURL(shutdownIcon),
  restart: nativeImage.createFromDataURL(restartIcon),
  folder: nativeImage.createFromDataURL(folderIcon),
  log: nativeImage.createFromDataURL(logIcon),
  web: nativeImage.createFromDataURL(webIcon),
  settings: nativeImage.createFromDataURL(settingsIcon),
};

/**
 * Toggle autostart setting
 */
function toggleAutostart() {
  try {
    const currentSetting = settingsManager.getAutostart();
    settingsManager.setAutostart(!currentSetting);
  } catch (error) {
    dialog.showErrorBox('Settings Error', `Failed to update autostart setting: ${error.message}`);
  }
}

/**
 * Toggle ready notification setting
 */
function toggleReadyNotification() {
  try {
    const currentSetting = settingsManager.getShowReadyNotification();
    settingsManager.setShowReadyNotification(!currentSetting);
  } catch (error) {
    dialog.showErrorBox(
      'Settings Error',
      `Failed to update notification setting: ${error.message}`
    );
  }
}

/**
 * Update service menu items based on running status
 * @param {string} serviceId - The service ID to update
 */
export function updateServiceMenuItems(serviceId) {
  if (!menu) return;

  const isRunning = serviceManager.isServiceRunning(serviceId);

  // Locate the service's submenu in the context menu
  const serviceMenuItem = menu.items.find(item => item.id === serviceId);
  if (!serviceMenuItem || !serviceMenuItem.submenu) return;

  // Update control buttons: Start enabled when stopped, Restart/Stop enabled when running
  serviceMenuItem.submenu.items.forEach(item => {
    if (item.label === 'Start') {
      item.enabled = !isRunning;
    } else if (item.label === 'Restart' || item.label === 'Stop') {
      item.enabled = isRunning;
    }
  });
}

/**
 * Create and initialize the system tray menu
 */
export async function createMenu() {
  tray = new Tray(icons.wemp);

  const version = app.getVersion();

  // Build dynamic menu items for each configured service
  const serviceMenuItems = config.services.map(service => {
    const isRunning = serviceManager.isServiceRunning(service.id);

    // Start with service info header (disabled for display only)
    const baseItems = [
      {
        label: `${service.name} ${service.version}`,
        icon: icons[service.id],
        enabled: false,
      },
      { type: 'separator' },
    ];

    // Add service control buttons for executable services
    if (service.executable) {
      baseItems.push(
        {
          label: 'Start',
          icon: icons.play,
          enabled: !isRunning,
          click: () => serviceManager.startService(service.id),
        },
        {
          label: 'Restart',
          icon: icons.restart,
          enabled: isRunning,
          click: () => serviceManager.restartService(service.id),
        },
        {
          label: 'Stop',
          icon: icons.shutdown,
          enabled: isRunning,
          click: () => serviceManager.stopService(service.id),
        }
      );
    }

    // Add browser link for services with web interfaces
    if (service.url) {
      baseItems.push({
        label: 'Open in Browser',
        icon: icons.web,
        click: () => shell.openExternal(service.url),
      });
    }

    // Add configuration and folder access options
    baseItems.push(
      { type: 'separator' },
      {
        label: 'Open Configuration',
        icon: icons.settings,
        click: () =>
          shell.openPath(path.join(serviceManager.servicesPath, service.id, service.configFile)),
      },
      {
        label: 'Open Folder',
        icon: icons.folder,
        click: () => shell.openPath(path.join(serviceManager.servicesPath, service.id)),
      }
    );

    return {
      id: service.id,
      label: service.name,
      icon: icons[service.id],
      submenu: baseItems,
    };
  });

  const menuTemplate = [
    {
      label: `Wemp ${version}`,
      icon: icons.wemp,
      submenu: [
        {
          label: 'Open Services Folder',
          icon: icons.folder,
          click: () => shell.openPath(serviceManager.servicesPath),
        },
        {
          label: 'View Error Logs',
          icon: icons.log,
          click: () => shell.openPath(logger.logPath),
        },
        { type: 'separator' },
        {
          label: 'Start with Windows',
          type: 'checkbox',
          checked: app.isPackaged ? settingsManager.getAutostart() : false,
          enabled: app.isPackaged,
          click: toggleAutostart,
        },
        {
          label: 'Show Ready Notification',
          type: 'checkbox',
          checked: settingsManager.getShowReadyNotification(),
          click: toggleReadyNotification,
        },
        { type: 'separator' },
      ],
    },
    { type: 'separator' },
    ...serviceMenuItems,
    { type: 'separator' },
    {
      label: 'Quit Wemp',
      icon: icons.shutdown,
      click: () => app.quit(),
    },
  ];

  // Create the menu and configure the system tray
  menu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(menu);
  tray.setToolTip('Wemp - Click to manage services');
  tray.on('click', () => tray.popUpContextMenu());
}

export { menu, tray };
