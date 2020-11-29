import { app } from 'electron'
import * as settings from 'electron-settings'
import * as path from 'path'

/**
 * This is the configuration of Wemp.
 *
 * The services are defined here and their version must be updated regularly.
 * Download URLs are subject to change, especially from PHP.
 */
export default {
    paths: {
        icons: path.join(app.getAppPath(), 'public/images/icons'),
        services: settings.getSync('path') ? settings.getSync('path').toString() : null,
        stubs: path.join(app.getAppPath(), 'stubs')
    },
    services: [
        {
            name: 'Nginx',
            url: 'https://nginx.org/download/nginx-{version}.zip',
            ignoredFiles: ['conf/', 'html/', 'logs/'],
            version: '1.19.5'
        },
        {
            name: 'MariaDB',
            url: 'https://archive.mariadb.org/mariadb-{version}/winx64-packages/mariadb-{version}-winx64.zip',
            version: '10.5.8'
        },
        {
            name: 'PHP',
            url: 'https://windows.php.net/downloads/releases/php-{version}-nts-Win32-vs16-x64.zip',
            ignoredFiles: ['extras/'],
            version: '8.0.0'
        }
    ]
}