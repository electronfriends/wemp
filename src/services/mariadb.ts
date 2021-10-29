import { exec } from 'child_process'
import path from 'path'

import config from '../config'
import Process from '../utils/process'

/**
 * The process instance of the service.
 */
export let process: Process

/**
 * MariaDB needs to be installed before the first start.
 */
export function install(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        exec('mysql_install_db.exe', {
            cwd: path.join(config.paths.services, 'mariadb', 'bin')
        }, (error) => {
            if (error) {
                return reject(error)
            }

            resolve()
        })
    })
}

/**
 * Start the service.
 */
export function start(): Promise<void> {
    process = new Process('mariadbd.exe', [], {
        cwd: path.join(config.paths.services, 'mariadb', 'bin')
    })

    return process.run()
}

/**
 * Stop the service.
 */
export function stop(): Promise<void> {
    return process?.kill()
}
