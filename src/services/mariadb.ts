import { exec } from 'child_process'
import * as path from 'path'

import config from '../config'
import { onServiceStopped } from '../utils/notification'

const servicePath = path.join(config.paths.services, 'mariadb/bin')

/**
 * Called when the service is first installed.
 */
export async function install() {
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
    exec('tasklist | find /i "mariadbd.exe" || mariadbd.exe', { cwd: servicePath }, (error) => {
        if (error) onServiceStopped('MariaDB')
    })
}

/**
 * Stop the service.
 */
export function stop() {
    exec('taskkill /IM "mariadbd.exe" /F')
}