import { app } from 'electron'
import settings from 'electron-settings'
import path from 'path'

/**
 * Configuration
 *
 * All paths and services are registered here.
 */
export default {
    paths: {
        icons: path.join(app.getAppPath(), 'icons'),
        logs: path.join(app.getPath('userData'), 'wemp.log'),
        services: settings.getSync('path')?.toString() || 'C:\\Wemp',
        stubs: path.join(app.getAppPath(), 'stubs')
    },
    services: [
        {
            name: 'Nginx',
            version: '1.20.0',
            config: 'conf/nginx.conf',
            url: 'https://nginx.org/download/nginx-{version}.zip',
            ignore: ['conf/', 'html/', 'logs/']
        },
        {
            name: 'MariaDB',
            version: '10.6.0',
            config: 'data/my.ini',
            url: 'https://archive.mariadb.org/mariadb-{version}/winx64-packages/mariadb-{version}-winx64.zip'
        },
        {
            name: 'PHP',
            version: '8.0.5',
            config: 'php.ini',
            url: 'https://windows.php.net/downloads/releases/php-{version}-nts-Win32-vs16-x64.zip',
            ignore: ['extras/']
        },
        {
            name: 'phpMyAdmin',
            interface: true,
            version: '5.1.0',
            config: 'config.inc.php',
            url: 'https://files.phpmyadmin.net/phpMyAdmin/{version}/phpMyAdmin-{version}-all-languages.zip'
        }
    ]
}
