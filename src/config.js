import path from 'node:path';

import { app } from 'electron';
import settings from 'electron-settings';

/**
 * Application configuration
 */
const config = {
  services: [
    {
      id: 'nginx',
      name: 'Nginx',
      version: '1.29.0',
      executable: 'nginx.exe',
      configFile: 'conf/nginx.conf',
      preserve: ['conf/', 'html/', 'logs/'],
      downloadUrl: 'https://nginx.org/download/nginx-{version}.zip',
    },
    {
      id: 'mariadb',
      name: 'MariaDB',
      version: '11.8.2',
      executable: 'mysqld.exe',
      executablePath: 'bin',
      configFile: 'data/my.ini',
      preserve: ['data/'],
      downloadUrl:
        'https://archive.mariadb.org/mariadb-{version}/winx64-packages/mariadb-{version}-winx64.zip',
    },
    {
      id: 'php',
      name: 'PHP',
      version: '8.3.24',
      executable: 'php-cgi.exe',
      configFile: 'php.ini',
      downloadUrl:
        'https://windows.php.net/downloads/releases/php-{version}-nts-Win32-vs16-x64.zip',
    },
    {
      id: 'phpmyadmin',
      name: 'phpMyAdmin',
      version: '5.2.2',
      url: 'http://localhost/phpmyadmin',
      configFile: 'config.inc.php',
      downloadUrl:
        'https://files.phpmyadmin.net/phpMyAdmin/{version}/phpMyAdmin-{version}-all-languages.zip',
    },
  ],

  paths: {
    get services() {
      return settings.getSync('path')?.toString() || path.join('C:', 'Wemp');
    },
    get stubs() {
      if (!app.isPackaged) {
        return path.resolve('stubs');
      }
      return path.join(process.resourcesPath, 'stubs');
    },
    get logs() {
      return path.join(app.getPath('userData'), 'error.log');
    },
  },

  timeouts: {
    start: 30000,
    restart: 1000,
    stop: 5000,
    poll: 1000,
  },

  watcher: {
    debounce: 100,
    restartCooldown: 5000,
  },
};

export default config;
