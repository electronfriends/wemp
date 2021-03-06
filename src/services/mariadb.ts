import { exec } from 'child_process'
import path from 'path'

import config from '../config'
import { updateMenuStatus } from '../main-process/menu'
import * as logger from '../utils/logger'
import { onServiceError } from '../utils/notification'

const servicePath = path.join(config.paths.services, 'mariadb/bin')

/**
 * Called when the service is first installed.
 */
export function install() {
    return new Promise<void>((resolve, reject) => {
        exec('mysql_install_db.exe', { cwd: servicePath }, (error) => {
            if (error) return reject(error)
            resolve()
        })
    })
}

/**
 * Start the service.
 */
export function start() {
    exec('tasklist | find /i "mariadbd.exe" > nul || mariadbd.exe', { cwd: servicePath }, (error, stdout, stderr) => {
        if (error) {
            logger.write(error, updateMenuStatus('MariaDB', false))
            return
        }

        if (stdout) logger.write(stdout)
        if (stderr && !stderr.includes('[Note]')) logger.write(stderr, onServiceError('MariaDB'))
    })
}

/**
 * Stop the service.
 */
export function stop() {
    exec('taskkill /IM "mariadbd.exe" /F')
}
