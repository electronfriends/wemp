import { app } from 'electron'
import settings from 'electron-settings'
import path from 'path'

/**
 * The configuration for Wemp, where the paths and services are defined.
 * When a service gets a new version, it must be updated here.
 */
export default {
  paths: {
    icons: path.join(app.getAppPath(), 'icons'),
    logs: path.join(app.getPath('userData'), 'error.log'),
    services: settings.getSync('path')?.toString() || 'C:\\Wemp'
  },
  services: [
    {
      name: 'Nginx',
      version: '1.24.0',
      config: 'conf/nginx.conf',
      ignore: ['conf/', 'html/', 'logs/'],
      url: 'https://nginx.org/download/nginx-{version}.zip'
    },
    {
      name: 'MariaDB',
      version: '10.11.2',
      config: 'data/my.ini',
      url: 'https://archive.mariadb.org/mariadb-{version}/winx64-packages/mariadb-{version}-winx64.zip'
    },
    {
      name: 'PHP',
      version: '8.2.5',
      config: 'php.ini',
      ignore: ['extras/'],
      url: 'https://windows.php.net/downloads/releases/php-{version}-nts-Win32-vs16-x64.zip'
    },
    {
      name: 'phpMyAdmin',
      version: '5.2.1',
      config: 'config.inc.php',
      interface: true,
      url: 'https://files.phpmyadmin.net/phpMyAdmin/{version}/phpMyAdmin-{version}-all-languages.zip'
    }
  ]
}
