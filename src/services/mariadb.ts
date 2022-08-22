import { exec, execSync, spawn } from 'child_process'
import path from 'path'

import config from '../config'
import Process from '../utils/process'

/**
 * The process instance of the service.
 */
export let process: Process

/**
 * The path to the binaries of the service.
 */
const servicePath: string = path.join(config.paths.services, 'mariadb', 'bin')

/**
 * MariaDB needs to be installed before the first start.
 */
export function install(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        exec('mysql_install_db.exe', { cwd: servicePath }, (error) => {
            if (error) {
                return reject(error)
            }

            resolve()
        })
    })
}

/**
 * Shut down the server properly before an update.
 */
export function shutdown(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const process = spawn('mariadbd.exe', ['--skip-grant-tables'], { cwd: servicePath })

        // Here we wait for the startup message from the MariaDB server.
        // This way we can make sure that the server is actually started.
        process.stderr.once('data', () => {
            execSync('mysqladmin.exe shutdown -u root', { cwd: servicePath })
            resolve()
        })

        process.on('error', (error: Error)=> {
            reject(error)
        })
    })
}

/**
 * Run the upgrade tool to check and update the tables after an update.
 */
export function upgrade(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        exec('mysql_upgrade.exe', { cwd: servicePath }, (error) => {
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
    process = new Process('MariaDB', 'mariadbd.exe', [], { cwd: servicePath })

    return process.run()
}

/**
 * Stop the service.
 */
export function stop(): Promise<void> {
    return process?.kill()
}
