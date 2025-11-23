import path from 'node:path';

import { app } from 'electron';
import settings from 'electron-settings';

/**
 * Application configuration and service definitions
 */
const config = {
  /**
   * Service configurations
   */
  services: {
    nginx: {
      name: 'Nginx',
      executable: 'nginx.exe',
      configFile: 'conf/nginx.conf',
      preserve: ['conf/', 'html/', 'logs/'],
    },
    mariadb: {
      name: 'MariaDB',
      executable: 'mysqld.exe',
      executablePath: 'bin',
      configFile: 'data/my.ini',
      preserve: ['data/'],
    },
    php: {
      name: 'PHP',
      executable: 'php-cgi.exe',
      configFile: 'php.ini',
      processArgs: ['-b', '127.0.0.1:9000'],
      env: {
        PHP_FCGI_MAX_REQUESTS: '0',
      },
    },
    phpmyadmin: {
      name: 'phpMyAdmin',
      url: 'http://localhost/phpmyadmin',
      configFile: 'config.inc.php',
    },
  },

  /**
   * API configuration for version checking and downloads
   */
  api: {
    baseUrl: process.env.WEMP_API_BASE_URL || 'https://electronfriends.org/api/wemp',
    endpoints: {
      versions: '/versions.json',
    },
    timeout: 10000,
  },

  /**
   * Dynamic paths that depend on runtime configuration
   */
  paths: {
    get services() {
      return settings.getSync('path')?.toString() || path.join('C:', 'Wemp');
    },
    get logs() {
      return path.join(app.getPath('userData'), 'error.log');
    },
  },

  /**
   * Timeout configuration (ms)
   */
  timeout: {
    stop: 3000,
  },

  /**
   * File watcher configuration (ms)
   */
  watcher: {
    pollInterval: 1000,
  },

  /**
   * Logger configuration
   */
  logger: {
    maxLogSize: 5 * 1024 * 1024,
    maxLogFiles: 3,
  },
};

export default config;
