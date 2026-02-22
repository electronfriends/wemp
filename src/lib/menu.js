import path from 'node:path';

import { Menu, Tray, app, dialog, nativeImage, shell } from 'electron';
import settings from 'electron-settings';

import config from '../config.js';
import logger from './logger.js';
import * as notifications from './notifications.js';
import * as pathManager from './path-manager.js';
import { serviceManager } from './service-manager.js';

import folderIcon from '../assets/folder.png?asset';
import logIcon from '../assets/event-log.png?asset';
import mariadbIcon from '../assets/mariadb.png?asset';
import nginxIcon from '../assets/nginx.png?asset';
import phpmyadminIcon from '../assets/phpmyadmin.png?asset';
import phpIcon from '../assets/php.png?asset';
import playIcon from '../assets/circled-play.png?asset';
import restartIcon from '../assets/restart.png?asset';
import settingsIcon from '../assets/settings.png?asset';
import shutdownIcon from '../assets/shutdown.png?asset';
import webIcon from '../assets/web.png?asset';
import wempIcon from '../assets/wemp.png?asset';

/** @type {Tray|null} System tray instance */
let tray;

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
  tray.setToolTip('Wemp - Click to manage services');

  tray.on('click', () => {
    tray.popUpContextMenu();
  });

  // Listen for service state changes to rebuild menu
  const safeBuildMenu = () => buildMenu().catch(err => logger.error('Failed to build menu', err));
  serviceManager.on('service-started', safeBuildMenu);
  serviceManager.on('service-stopped', safeBuildMenu);
  serviceManager.versionManager.on('version-changed', safeBuildMenu);

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
        {
          label: 'Edit Settings',
          icon: icons.settings,
          click: () => {
            shell.openPath(settings.file());
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
      const serviceVersion = serviceManager.versionManager?.getDisplayVersion(serviceId) || '';

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
            { label: `${service.name} ${version}`, icon: serviceIcon, enabled: false },
            { type: 'separator' },
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
            notifications.showServiceError(service.name, error.message);
          }
        },
      });

      // Build submenu items
      const submenuItems = [];
      const serviceState = serviceManager.versionManager.serviceStates.get(serviceId);
      const currentVersion = serviceManager.versionManager.getCurrentVersion(serviceId);
      const availableVersions = serviceState?.availableVersions || [];
      const installedVersions = serviceManager.versionManager.getInstalledVersions(serviceId);

      if (serviceState?.multiVersion && availableVersions.length > 0) {
        // Group versions by major.minor and show installed version for each if available
        const versionMap = new Map();

        // First, add all available versions grouped by major.minor
        availableVersions.forEach(v => {
          const majorMinor = v.version.split('.').slice(0, 2).join('.');
          if (!versionMap.has(majorMinor)) {
            versionMap.set(majorMinor, {
              version: v.version,
              deprecated: v.deprecated,
              hasUpdate: false,
            });
          }
        });

        // Replace with installed versions and check for updates
        installedVersions.forEach(installedVer => {
          const majorMinor = installedVer.split('.').slice(0, 2).join('.');
          const apiVersion = availableVersions.find(av => av.version === installedVer);

          // Find latest version in same major.minor series
          const sameSeriesVersions = availableVersions
            .filter(av => {
              const avMajorMinor = av.version.split('.').slice(0, 2).join('.');
              return avMajorMinor === majorMinor && !av.deprecated;
            })
            .map(av => av.version)
            .sort((a, b) => {
              const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
              const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
              return bMajor - aMajor || bMinor - aMinor || bPatch - aPatch;
            });

          const latestInSeries = sameSeriesVersions[0];
          const hasUpdate = latestInSeries && latestInSeries !== installedVer;

          versionMap.set(majorMinor, {
            version: installedVer,
            deprecated: apiVersion ? apiVersion.deprecated : false,
            hasUpdate,
          });
        });

        // Sort by version (newest first)
        const sortedVersions = Array.from(versionMap.values()).sort((a, b) => {
          const [aMajor, aMinor, aPatch] = a.version.split('.').map(Number);
          const [bMajor, bMinor, bPatch] = b.version.split('.').map(Number);
          return bMajor - aMajor || bMinor - aMinor || bPatch - aPatch;
        });

        submenuItems.push(
          {
            label: `${service.name} ${currentVersion || serviceVersion}`,
            icon: serviceIcon,
            submenu: sortedVersions.map(versionData => ({
              label: versionData.hasUpdate
                ? `🔄 ${versionData.version}`
                : versionData.deprecated
                  ? `⚠️ ${versionData.version}`
                  : versionData.version,
              type: 'radio',
              checked: currentVersion === versionData.version,
              click: async () => {
                // No-op if already selected
                if (currentVersion === versionData.version) return;

                try {
                  if (isRunning) {
                    await serviceManager.stopService(serviceId);
                  }
                  await serviceManager.versionManager.switchServiceVersion(
                    serviceId,
                    versionData.version,
                    true // Check for patch updates when switching
                  );
                  if (isRunning) {
                    await serviceManager.startService(serviceId);
                  }
                } catch (error) {
                  logger.error(`Failed to switch ${service.name} version:`, error);
                  notifications.showServiceError(
                    service.name,
                    `Failed to switch version: ${error.message}`
                  );
                }
              },
            })),
          },
          { type: 'separator' }
        );
      } else {
        submenuItems.push(
          { label: `${service.name} ${serviceVersion}`, icon: serviceIcon, enabled: false },
          { type: 'separator' }
        );
      }

      submenuItems.push(
        createServiceAction('Start', 'start', 'play', !isRunning),
        createServiceAction('Restart', 'restart', 'restart', isRunning),
        createServiceAction('Stop', 'stop', 'shutdown', isRunning),
        { type: 'separator' },
        ...configItems
      );

      return {
        label: service.name,
        icon: serviceIcon,
        submenu: submenuItems,
      };
    }),
    { type: 'separator' },
    {
      label: 'Quit Wemp',
      icon: icons.shutdown,
      click: () => app.quit(),
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(menu);
}

export { tray };
