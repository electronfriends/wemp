import { ChildProcess, exec } from 'child_process'
import path from 'path'

import config from '../config'

/**
 * The child process of the service.
 */
let process: ChildProcess

/**
 * MariaDB needs to be installed before the first start.
 *
 * @returns {Promise}
 */
export function install(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        exec('mysql_install_db.exe', {
            cwd: path.join(config.paths.services, 'mariadb', 'bin')
        }, error => {
            if (error) return reject(error)
            resolve()
        })
    })
}

/**
 * Start the service.
 *
 * @returns {Promise}
 */
export function start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        process = exec('tasklist | find /i "mariadbd.exe" > nul || mariadbd.exe', {
            cwd: path.join(config.paths.services, 'mariadb', 'bin')
        }, (error) => {
            if (error && !error.killed) return reject(error)
            resolve()
        })
    })
}

/**
 * Stop the service.
 *
 * @returns {Promise}
 */
export function stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (process) process.kill()

        exec('taskkill /IM "mariadbd.exe" /F', (error) => {
            if (error) return reject(error)
            resolve()
        })
    })
}
