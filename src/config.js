import path from 'node:path';

import { app } from 'electron';
import settings from 'electron-settings';

/**
 * @typedef ServiceConfig
 * @property {string} id - Service identifier (nginx, mariadb, php, phpmyadmin)
 * @property {string} name - Display name
 * @property {string} version - Semantic version (x.y.z)
 * @property {string} config - Configuration file path
 * @property {string} downloadUrl - URL template with {version} placeholder
 * @property {string[]} [ignore] - Files/paths to ignore during updates
 */

/** @type {ServiceConfig[]} */
const SERVICES = [
  {
    id: 'nginx',
    name: 'Nginx',
    version: '1.29.0',
    config: 'conf/nginx.conf',
    ignore: ['conf/', 'html/'],
    downloadUrl: 'https://nginx.org/download/nginx-{version}.zip'
  },
  {
    id: 'mariadb',
    name: 'MariaDB',
    version: '11.8.2',
    config: 'data/my.ini',
    downloadUrl: 'https://archive.mariadb.org/mariadb-{version}/winx64-packages/mariadb-{version}-winx64.zip'
  },
  {
    id: 'php',
    name: 'PHP',
    version: '8.3.22',
    config: 'php.ini',
    ignore: ['extras/'],
    downloadUrl: 'https://windows.php.net/downloads/releases/php-{version}-nts-Win32-vs16-x64.zip'
  },
  {
    id: 'phpmyadmin',
    name: 'phpMyAdmin',
    version: '5.2.2',
    config: 'config.inc.php',
    downloadUrl: 'https://files.phpmyadmin.net/phpMyAdmin/{version}/phpMyAdmin-{version}-all-languages.zip'
  }
];

export const constants = {
  timeouts: {
    START: 30000,
    STOP: 3000,
    UPGRADE: 30000,
    DEBOUNCE: 1000
  },
  retries: {
    max: 3,
    delay: 3000,
    interval: 1000
  }
};

export default {
  paths: {
    logs: path.join(app.getPath('userData'), 'error.log'),
    services: settings.getSync('path')?.toString() || path.join('C:', 'Wemp'),
    stubs: path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'stubs')
  },
  services: SERVICES
};
