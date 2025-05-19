import path from 'node:path';

import { app, Menu, MenuItem, shell, Tray, nativeImage } from 'electron';
import settings from 'electron-settings';

import wempIcon from '../assets/wemp.png?asset';
import startIcon from '../assets/circled-play.png?asset';
import restartIcon from '../assets/restart.png?asset';
import shutdownIcon from '../assets/shutdown.png?asset';
import settingsIcon from '../assets/settings.png?asset';
import folderIcon from '../assets/folder.png?asset';
import webIcon from '../assets/web.png?asset';
import logIcon from '../assets/event-log.png?asset';
import nginxIcon from '../assets/nginx.png?asset';
import mariadbIcon from '../assets/mariadb.png?asset';
import phpIcon from '../assets/php.png?asset';
import phpmyadminIcon from '../assets/phpmyadmin.png?asset';

import config from '../config';
import { setServicesPath, startService, stopService, stopServices } from './manager';
import log from '../utils/logger';

export let menu, tray;

const icons = {
  wemp: nativeImage.createFromDataURL(wempIcon),
  start: nativeImage.createFromDataURL(startIcon),
  restart: nativeImage.createFromDataURL(restartIcon),
  shutdown: nativeImage.createFromDataURL(shutdownIcon),
  settings: nativeImage.createFromDataURL(settingsIcon),
  folder: nativeImage.createFromDataURL(folderIcon),
  web: nativeImage.createFromDataURL(webIcon),
  log: nativeImage.createFromDataURL(logIcon),
  nginx: nativeImage.createFromDataURL(nginxIcon),
  mariadb: nativeImage.createFromDataURL(mariadbIcon),
  php: nativeImage.createFromDataURL(phpIcon),
  phpmyadmin: nativeImage.createFromDataURL(phpmyadminIcon)
};

function createServiceMenuItem(service) {
  const serviceIcon = icons[service.id];

  const submenu = [
    {
      icon: serviceIcon,
      label: `${service.name} ${service.version}`,
      enabled: false
    },
    { type: 'separator' }
  ];

  if (service.id === 'phpmyadmin') {
    submenu.push({
      icon: icons.web,
      label: 'Open Web Interface',
      click: () => shell.openExternal('http://localhost/phpmyadmin')
    });
  } else {
    submenu.push(
      {
        icon: icons.start,
        label: 'Start',
        enabled: false,
        click: () => startService(service.id)
      },
      {
        icon: icons.restart,
        label: 'Restart',
        enabled: false,
        click: () => stopService(service.id, true)
      },
      {
        icon: icons.shutdown,
        label: 'Stop',
        enabled: false,
        click: () => stopService(service.id)
      },
      { type: 'separator' }
    );
  }

  submenu.push(
    {
      icon: icons.settings,
      label: 'Open Configuration',
      click: () => shell.openPath(path.join(config.paths.services, service.id, service.config))
    },
    {
      icon: icons.folder,
      label: 'Open Directory',
      click: () => shell.openPath(path.join(config.paths.services, service.id))
    }
  );

  return new MenuItem({
    icon: serviceIcon,
    id: service.id,
    label: service.name,
    submenu
  });
}

export function createMenu() {
  const menuTemplate = [
    {
      icon: icons.wemp,
      label: `Wemp ${app.getVersion()}`,
      submenu: [
        {
          icon: icons.restart,
          label: 'Restart All Services',
          click: () => stopServices(true)
        },
        {
          icon: icons.folder,
          label: 'Set Services Path',
          click: async () => {
            await setServicesPath();
            await stopServices();
            app.relaunch();
            app.exit(0);
          }
        },
        {
          icon: icons.log,
          label: 'View Error Logs',
          click: () => shell.openPath(config.paths.logs)
        },
        { type: 'separator' },
        {
          type: 'checkbox',
          label: 'Autostart Wemp',
          enabled: app.isPackaged,
          checked: (() => {
            const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
            const exeName = path.basename(process.execPath);
            const loginSettings = {
              path: updateExe,
              args: ['--processStart', exeName]
            };

            return app.getLoginItemSettings(loginSettings).openAtLogin;
          })(),
          click: (menuItem) => {
            const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
            const exeName = path.basename(process.execPath);
            const loginSettings = {
              openAtLogin: menuItem.checked,
              path: updateExe,
              args: ['--processStart', exeName]
            };

            app.setLoginItemSettings(loginSettings);
          }
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
    ...config.services.map(createServiceMenuItem),
    { type: 'separator' },
    {
      icon: icons.shutdown,
      label: 'Quit Wemp',
      click: () => app.quit()
    }
  ];

  menu = Menu.buildFromTemplate(menuTemplate);
  tray = new Tray(icons.wemp);

  tray.on('click', () => tray.popUpContextMenu());
  tray.setToolTip('Click to manage your web server');
  tray.setContextMenu(menu);
}

export function updateMenuStatus(name, isRunning) {
  const serviceMenu = menu.getMenuItemById(name);
  if (!serviceMenu) {
    log.warn(`Menu for service '${name}' does not exist`);
    return;
  }

  const [, , startItem, restartItem, stopItem] = serviceMenu.submenu.items;

  if (startItem && restartItem && stopItem) {
    startItem.enabled = !isRunning;
    restartItem.enabled = stopItem.enabled = isRunning;
  }
}
