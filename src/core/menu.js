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

const iconMap = {
  wemp: wempIcon,
  start: startIcon,
  restart: restartIcon,
  shutdown: shutdownIcon,
  settings: settingsIcon,
  folder: folderIcon,
  web: webIcon,
  log: logIcon,
  nginx: nginxIcon,
  mariadb: mariadbIcon,
  php: phpIcon,
  phpmyadmin: phpmyadminIcon
};

function createServiceMenuItem(service) {
  const serviceIcon = nativeImage.createFromDataURL(iconMap[service.id]);

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
      icon: nativeImage.createFromDataURL(iconMap.web),
      label: 'Open Web Interface',
      click: () => shell.openExternal('http://localhost/phpmyadmin')
    });
  } else {
    submenu.push(
      {
        icon: nativeImage.createFromDataURL(iconMap.start),
        label: 'Start',
        enabled: false,
        click: () => startService(service.id)
      },
      {
        icon: nativeImage.createFromDataURL(iconMap.restart),
        label: 'Restart',
        enabled: false,
        click: () => stopService(service.id, true)
      },
      {
        icon: nativeImage.createFromDataURL(iconMap.shutdown),
        label: 'Stop',
        enabled: false,
        click: () => stopService(service.id)
      },
      { type: 'separator' }
    );
  }

  submenu.push(
    {
      icon: nativeImage.createFromDataURL(iconMap.settings),
      label: 'Open Configuration',
      click: () => shell.openPath(`${config.paths.services}/${service.id}/${service.config}`)
    },
    {
      icon: nativeImage.createFromDataURL(iconMap.folder),
      label: 'Open Directory',
      click: () => shell.openPath(`${config.paths.services}/${service.id}`)
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
      icon: nativeImage.createFromDataURL(iconMap.wemp),
      label: `Wemp ${app.getVersion()}`,
      submenu: [
        {
          icon: nativeImage.createFromDataURL(iconMap.restart),
          label: 'Restart All Services',
          click: () => stopServices(true)
        },
        {
          icon: nativeImage.createFromDataURL(iconMap.folder),
          label: 'Set Services Path',
          click: async () => {
            await setServicesPath();
            await stopServices();
            app.relaunch();
            app.exit(0);
          }
        },
        {
          icon: nativeImage.createFromDataURL(iconMap.log),
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
      icon: nativeImage.createFromDataURL(iconMap.shutdown),
      label: 'Quit Wemp',
      click: () => app.quit()
    }
  ];

  menu = Menu.buildFromTemplate(menuTemplate);
  tray = new Tray(nativeImage.createFromDataURL(iconMap.wemp));

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
