import path from 'path';

import { app } from 'electron';
import settings from 'electron-settings';

const defaultPath = 'C:\\Wemp';

export default {
  paths: {
    icons: path.join(app.getAppPath(), 'icons'),
    logs: path.join(app.getPath('userData'), 'error.log'),
    services: settings.getSync('path')?.toString() || defaultPath
  },
  services: [
    {
      name: 'Nginx',
      version: '1.25.4',
      config: 'conf/nginx.conf',
      ignore: ['conf/', 'html/', 'logs/'],
      downloadUrl: 'https://nginx.org/download/nginx-{version}.zip'
    },
    {
      name: 'MariaDB',
      version: '11.3.2',
      config: 'data/my.ini',
      downloadUrl: 'https://archive.mariadb.org/mariadb-{version}/winx64-packages/mariadb-{version}-winx64.zip'
    },
    {
      name: 'PHP',
      version: '8.3.6',
      config: 'php.ini',
      ignore: ['extras/'],
      downloadUrl: 'https://windows.php.net/downloads/releases/php-{version}-nts-Win32-vs16-x64.zip'
    },
    {
      name: 'phpMyAdmin',
      version: '5.2.1',
      config: 'config.inc.php',
      downloadUrl: 'https://files.phpmyadmin.net/phpMyAdmin/{version}/phpMyAdmin-{version}-all-languages.zip',
      webInterfaceUrl: 'http://localhost/phpmyadmin'
    }
  ]
};
