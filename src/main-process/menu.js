import path from 'path';

import { Menu, MenuItem, Tray, app, shell } from 'electron';
import settings from 'electron-settings';

import config from '../config';
import logger from '../utils/logger';
import { setServicesPath, startService, stopService, stopServices } from './manager';

export let menu, tray;

/**
 * Create the menu template and tray.
 */
export function createMenu() {
  const iconsPath = config.paths.icons;
  const servicesPath = config.paths.services;

  const createServiceMenuItem = (service) => {
    const serviceName = service.name.toLowerCase();

    return new MenuItem({
      icon: path.join(iconsPath, serviceName + '.png'),
      id: service.name,
      label: service.name,
      visible: false,
      submenu: [
        {
          icon: path.join(iconsPath, serviceName + '.png'),
          label: `${service.name} ${service.version}`,
          enabled: false
        },
        { type: 'separator' },
        {
          icon: path.join(iconsPath, 'circled-play.png'),
          id: `${service.name}-start`,
          label: 'Start',
          click: () => startService(service.name)
        },
        {
          icon: path.join(iconsPath, 'restart.png'),
          id: `${service.name}-restart`,
          label: 'Restart',
          click: () => stopService(service.name, true)
        },
        {
          icon: path.join(iconsPath, 'shutdown.png'),
          id: `${service.name}-stop`,
          label: 'Stop',
          click: () => stopService(service.name)
        },
        { type: 'separator' },
        {
          icon: path.join(iconsPath, 'settings.png'),
          label: 'Open Configuration',
          click: () => shell.openPath(path.join(servicesPath, serviceName, service.config))
        },
        {
          icon: path.join(iconsPath, 'file-explorer.png'),
          label: 'Open Directory',
          click: () => shell.openPath(path.join(servicesPath, serviceName))
        }
      ]
    });
  };

  const serviceMenuItems = config.services
    .filter(service => !service.interface)
    .map(createServiceMenuItem);

  const menuTemplate = [
    {
      icon: path.join(iconsPath, 'wemp.png'),
      label: `Wemp ${app.getVersion()}`,
      submenu: [
        {
          icon: path.join(iconsPath, 'restart.png'),
          label: 'Restart All Services',
          click: () => stopServices(true)
        },
        {
          icon: path.join(iconsPath, 'folder.png'),
          label: 'Set Services Path',
          click: () => {
            setServicesPath().then(async () => {
              await stopServices();
              app.relaunch();
              app.exit(0);
            });
          }
        },
        {
          icon: path.join(iconsPath, 'event-log.png'),
          label: 'View Error Logs',
          click: () => shell.openPath(config.paths.logs)
        },
        { type: 'separator' },
        {
          type: 'checkbox',
          label: 'Autostart Wemp',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (menuItem) => app.setLoginItemSettings({ openAtLogin: menuItem.checked })
        },
        {
          type: 'checkbox',
          label: 'Show Ready Notification',
          checked: settings.getSync('showReadyNotification'),
          click: (menuItem) => settings.setSync('showReadyNotification', menuItem.checked)
        }
      ]
    },
    { type: 'separator' },
    ...serviceMenuItems,
    { type: 'separator' },
    {
      icon: path.join(iconsPath, 'shutdown.png'),
      label: 'Quit Wemp',
      click: () => app.quit()
    }
  ];

  // Build the menu using the template.
  menu = Menu.buildFromTemplate(menuTemplate);

  // Create the tray.
  tray = new Tray(path.join(iconsPath, 'wemp.png'));
  tray.on('click', () => tray.popUpContextMenu());
  tray.setToolTip('Click to manage your web server');
  tray.setContextMenu(menu);
}

/**
 * Update the status of a menu item based on the service's running state.
 * @param {string} name - The name of the service.
 * @param {boolean} isRunning - Whether the service is running.
 */
export function updateMenuStatus(name, isRunning) {
  const serviceMenu = menu.getMenuItemById(name);

  if (serviceMenu) {
    const startItem = menu.getMenuItemById(`${name}-start`);
    const restartItem = menu.getMenuItemById(`${name}-restart`);
    const stopItem = menu.getMenuItemById(`${name}-stop`);

    if (startItem) {
      startItem.enabled = !isRunning;
    }

    if (restartItem && stopItem) {
      restartItem.enabled = stopItem.enabled = isRunning;
    }

    serviceMenu.visible = true;
  } else {
    logger(`Menu for service '${name}' does not exist.`);
  }
}
