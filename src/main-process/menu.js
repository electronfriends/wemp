import path from 'node:path';

import { Menu, MenuItem, Tray, app, shell } from 'electron';
import settings from 'electron-settings';

import config from '../config';
import logger from '../utils/logger';
import { setServicesPath, startService, stopService, stopServices } from './manager';

export let menu, tray;

const iconsPath = config.paths.icons;

/**
 * Create a service menu item.
 * @param {Object} service - The service object.
 * @returns {MenuItem} - The created menu item.
 */
function createServiceMenuItem(service) {
  const serviceName = service.name.toLowerCase();
  const submenu = service.name !== 'phpMyAdmin' ? [
    { icon: path.join(iconsPath, 'circled-play.png'), label: 'Start', click: () => startService(service.name) },
    { icon: path.join(iconsPath, 'restart.png'), label: 'Restart', click: () => stopService(service.name, true) },
    { icon: path.join(iconsPath, 'shutdown.png'), label: 'Stop', click: () => stopService(service.name) },
    { type: 'separator' }
  ] : [
    { icon: path.join(iconsPath, 'web.png'), label: 'Open Web Interface', click: () => shell.openExternal(service.webInterfaceUrl) },
  ];

  return new MenuItem({
    icon: path.join(iconsPath, serviceName + '.png'),
    id: service.name,
    label: service.name,
    visible: service.name === 'phpMyAdmin',
    submenu: [
      { icon: path.join(iconsPath, serviceName + '.png'), label: `${service.name} ${service.version}`, enabled: false },
      { type: 'separator' },
      ...submenu,
      { icon: path.join(iconsPath, 'settings.png'), label: 'Open Configuration', click: () => shell.openPath(path.join(config.paths.services, serviceName, service.config)) },
      { icon: path.join(iconsPath, 'folder.png'), label: 'Open Directory', click: () => shell.openPath(path.join(config.paths.services, serviceName)) }
    ]
  });
}

/**
 * Create the menu template and tray.
 */
export function createMenu() {
  const serviceMenuItems = config.services.map(createServiceMenuItem);

  const menuTemplate = [
    {
      icon: path.join(iconsPath, 'wemp.png'),
      label: `Wemp ${app.getVersion()}`,
      submenu: [
        { icon: path.join(iconsPath, 'restart.png'), label: 'Restart All Services', click: () => stopServices(true) },
        { icon: path.join(iconsPath, 'folder.png'), label: 'Set Services Path', click: async () => { await setServicesPath(); await stopServices(); app.relaunch(); app.exit(0); } },
        { icon: path.join(iconsPath, 'event-log.png'), label: 'View Error Logs', click: () => shell.openPath(config.paths.logs) },
        { type: 'separator' },
        { type: 'checkbox', label: 'Autostart Wemp', checked: app.getLoginItemSettings().openAtLogin, click: (menuItem) => app.setLoginItemSettings({ openAtLogin: menuItem.checked }) },
        { type: 'checkbox', label: 'Show Ready Notification', checked: settings.getSync('showReadyNotification'), click: (menuItem) => settings.setSync('showReadyNotification', menuItem.checked) }
      ]
    },
    { type: 'separator' },
    ...serviceMenuItems,
    { type: 'separator' },
    { icon: path.join(iconsPath, 'shutdown.png'), label: 'Quit Wemp', click: () => app.quit() }
  ];

  menu = Menu.buildFromTemplate(menuTemplate);
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
    const startItem = serviceMenu.submenu.items.find(item => item.label === 'Start');
    const restartItem = serviceMenu.submenu.items.find(item => item.label === 'Restart');
    const stopItem = serviceMenu.submenu.items.find(item => item.label === 'Stop');

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
