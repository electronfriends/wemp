import path from 'node:path';

import { Menu, Tray, app, dialog, nativeImage, shell } from 'electron';

import config from '../config.js';
import logger from './logger.js';
import * as pathManager from './path-manager.js';
import { serviceManager } from './service-manager.js';

import wempIcon from '../assets/wemp.png?asset';
import playIcon from '../assets/circled-play.png?asset';
import shutdownIcon from '../assets/shutdown.png?asset';
import restartIcon from '../assets/restart.png?asset';
import folderIcon from '../assets/folder.png?asset';
import logIcon from '../assets/event-log.png?asset';
import webIcon from '../assets/web.png?asset';
import settingsIcon from '../assets/settings.png?asset';
import nginxIcon from '../assets/nginx.png?asset';
import mariadbIcon from '../assets/mariadb.png?asset';
import phpIcon from '../assets/php.png?asset';
import phpmyadminIcon from '../assets/phpmyadmin.png?asset';

/** @type {Tray|null} System tray instance */
let tray;
/** @type {Menu|null} Context menu instance */
let menu;

/** @type {Object.<string, NativeImage>} Preloaded menu icons */
const icons = {
  wemp: nativeImage.createFromDataURL(wempIcon),
  play: nativeImage.createFromDataURL(playIcon),
  shutdown: nativeImage.createFromDataURL(shutdownIcon),
  restart: nativeImage.createFromDataURL(restartIcon),
  folder: nativeImage.createFromDataURL(folderIcon),
  log: nativeImage.createFromDataURL(logIcon),
  web: nativeImage.createFromDataURL(webIcon),
  settings: nativeImage.createFromDataURL(settingsIcon),
  nginx: nativeImage.createFromDataURL(nginxIcon),
  mariadb: nativeImage.createFromDataURL(mariadbIcon),
  php: nativeImage.createFromDataURL(phpIcon),
  phpmyadmin: nativeImage.createFromDataURL(phpmyadminIcon),
};

/**
 * Initializes system tray menu interface
 */
export function createMenu() {
  tray = new Tray(icons.wemp);
  tray.setToolTip(app.getName());

  tray.on('click', () => {
    tray.popUpContextMenu();
  });

  // Listen for service state changes to update menu
  serviceManager.on('service-started', updateServiceMenuItems);
  serviceManager.on('service-stopped', updateServiceMenuItems);

  buildMenu();
}

/**
 * Constructs system tray context menu with current service status
 * @private
 */
async function buildMenu() {
  const status = serviceManager.getStatus();
  const version = app.getVersion();

  // Auto-start functionality
  const getAutoStartSettings = () => {
    if (!app.isPackaged) return { openAtLogin: false, canToggle: false };

    const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
    const exeName = path.basename(process.execPath);

    const { openAtLogin } = app.getLoginItemSettings({
      path: updateExe,
      args: ['--processStart', exeName],
    });

    return { openAtLogin, canToggle: true };
  };

  const autoStart = getAutoStartSettings();
  const pathIncludesServices = await pathManager.areServicePathsInPath();

  const menuTemplate = [
    {
      label: `${app.getName()} ${version}`,
      icon: icons.wemp,
      submenu: [
        {
          label: 'Open Services Folder',
          icon: icons.folder,
          click: () => {
            shell.openPath(config.paths.services);
          },
        },
        {
          label: 'View Error Logs',
          icon: icons.log,
          click: () => {
            shell.openPath(config.paths.logs);
          },
        },
        { type: 'separator' },
        {
          label: 'Start with Windows',
          type: 'checkbox',
          checked: autoStart.openAtLogin,
          enabled: autoStart.canToggle,
          click: () => {
            const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
            const exeName = path.basename(process.execPath);

            app.setLoginItemSettings({
              openAtLogin: !autoStart.openAtLogin,
              path: updateExe,
              args: ['--processStart', exeName],
            });
          },
        },
        {
          label: 'Add Services to PATH',
          type: 'checkbox',
          checked: pathIncludesServices,
          click: async () => {
            try {
              await pathManager.toggleServicePathsInPath();
            } catch (error) {
              logger.error('Failed to toggle PATH:', error);
              dialog.showErrorBox('PATH Update Failed', error.message);
            }
          },
        },
      ],
    },
    { type: 'separator' },

    // Dynamic service controls
    ...Object.keys(config.services).map(serviceId => {
      const service = config.services[serviceId];
      const isRunning = status[serviceId];
      const serviceIcon = icons[serviceId];
      const version = serviceManager.versionManager?.getDisplayVersion(serviceId) || '';

      const headerItems = [
        { label: `${service.name} ${version}`, icon: serviceIcon, enabled: false },
        { type: 'separator' },
      ];

      const configItems = [
        {
          label: 'Edit Configuration',
          icon: icons.settings,
          click: () =>
            shell.openPath(path.join(config.paths.services, serviceId, service.configFile)),
        },
        {
          label: 'Open Folder',
          icon: icons.folder,
          click: () => shell.openPath(path.join(config.paths.services, serviceId)),
        },
      ];

      if (serviceId === 'phpmyadmin') {
        return {
          label: service.name,
          icon: serviceIcon,
          submenu: [
            ...headerItems,
            {
              label: 'Open in Browser',
              icon: icons.web,
              enabled: status.nginx && status.php,
              click: () => shell.openExternal(service.url),
            },
            { type: 'separator' },
            ...configItems,
          ],
        };
      }

      const createServiceAction = (label, action, iconKey, enabledCondition) => ({
        label,
        icon: icons[iconKey],
        enabled: enabledCondition,
        click: async () => {
          try {
            await serviceManager[`${action}Service`](serviceId);
          } catch (error) {
            logger.error(`Failed to ${action} ${service.name}:`, error);
            dialog.showErrorBox(`${label} Error`, error.message);
          }
        },
      });

      return {
        label: service.name,
        icon: serviceIcon,
        submenu: [
          ...headerItems,
          createServiceAction('Start', 'start', 'play', !isRunning),
          createServiceAction('Restart', 'restart', 'restart', isRunning),
          createServiceAction('Stop', 'stop', 'shutdown', isRunning),
          { type: 'separator' },
          ...configItems,
        ],
      };
    }),
    { type: 'separator' },
    {
      label: 'Quit Wemp',
      icon: icons.shutdown,
      click: () => app.quit(),
    },
  ];

  menu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(menu);
}

/**
 * Updates service menu item states based on current service status
 * Called when services start or stop to reflect current state
 */
function updateServiceMenuItems() {
  if (!menu) return;

  const status = serviceManager.getStatus();
  let serviceIndex = 2; // Skip main menu and separator

  // Update enabled state for each service's actions
  Object.keys(config.services).forEach(serviceId => {
    const menuItem = menu.items[serviceIndex++];
    if (!menuItem?.submenu) return;

    const isRunning = status[serviceId];
    const submenuItems = menuItem.submenu.items;

    submenuItems.forEach(item => {
      if (serviceId === 'phpmyadmin') {
        // phpMyAdmin requires nginx and PHP to be running
        if (item.label === 'Open in Browser') {
          item.enabled = status.nginx && status.php;
        }
      } else {
        // Standard services can be started/stopped/restarted
        if (item.label === 'Start') item.enabled = !isRunning;
        else if (item.label === 'Stop' || item.label === 'Restart') item.enabled = isRunning;
      }
    });
  });
}

export { tray };
