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

let tray;
let menu;

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
 * @returns {Promise<void>}
 */
async function toggleAutostart() {
  try {
    const currentSetting = settingsManager.getAutostart();
    await settingsManager.setAutostart(!currentSetting);
  } catch (error) {
    dialog.showErrorBox('Settings Error', `Failed to update autostart setting: ${error.message}`);
  }
}

/**
 * Toggle PATH management for all services
 * @returns {Promise<void>}
 */
async function toggleAllServicesPath() {
  try {
    const pathSettings = await settingsManager.getPathSettings();
    const serviceIds = config.services.filter(s => s.executable).map(s => s.id);

    const anyInPath = serviceIds.some(id => pathSettings[id]);
    const shouldAdd = !anyInPath;

    for (const id of serviceIds) {
      await settingsManager.setServiceInPath(id, shouldAdd);
    }
  } catch (error) {
    dialog.showErrorBox('Settings Error', `Failed to update PATH settings: ${error.message}`);
  }
}

/**
 * Update service menu items based on running status
 * @param {string} serviceId - The service ID to update
 */
export function updateServiceMenuItems(serviceId) {
  if (!menu) return;

  const isRunning = serviceManager.isServiceRunning(serviceId);

  // Find the service submenu
  const serviceMenuItem = menu.items.find(item => item.id === serviceId);
  if (!serviceMenuItem || !serviceMenuItem.submenu) return;

  // Update Start/Restart/Stop buttons based on running status
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
  tray.on('click', () => tray.popUpContextMenu());

  const version = app.getVersion();
  const pathSettings = await settingsManager.getPathSettings();

  // Build individual service menu items
  const serviceMenuItems = config.services.map(service => {
    const isRunning = serviceManager.isServiceRunning(service.id);

    const baseItems = [
      {
        label: `${service.name} ${service.version}`,
        icon: icons[service.id],
        enabled: false,
      },
      { type: 'separator' },
    ];

    // Services with executables get start/restart/stop controls
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

    // Services with URLs get browser link
    if (service.url) {
      baseItems.push({
        label: 'Open in Browser',
        icon: icons.web,
        click: () => shell.openExternal(service.url),
      });
    }

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
          label: 'Open Services Directory',
          icon: icons.folder,
          click: () => shell.openPath(serviceManager.servicesPath),
        },
        {
          label: 'View Application Logs',
          icon: icons.log,
          click: () => shell.openPath(logger.logPath),
        },
        { type: 'separator' },
        {
          label: 'Add Services to PATH',
          type: 'checkbox',
          checked: (() => {
            const serviceIds = config.services.filter(s => s.executable).map(s => s.id);
            return serviceIds.every(id => pathSettings[id] || false);
          })(),
          click: toggleAllServicesPath,
        },
        {
          label: 'Start with Windows',
          type: 'checkbox',
          checked: app.isPackaged ? settingsManager.getAutostart() : false,
          enabled: app.isPackaged,
          click: toggleAutostart,
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

  menu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(menu);
  tray.setToolTip('Wemp');
}

export { menu, tray };
