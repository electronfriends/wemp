import { ChildProcess, exec } from 'child_process'
import path from 'path'

import config from '../config'

/**
 * The child process of the service.
 */
let process: ChildProcess

/**
 * MariaDB needs to be installed before the first start.
 */
export function install(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        exec('mysql_install_db.exe', {
            cwd: path.join(config.paths.services, 'mariadb', 'bin')
        }, (error) => {
            if (error) return reject(error)
            resolve()
        })
    })
}

/**
 * Start the service.
 */
export function start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        process = exec('tasklist | find /i "mariadbd.exe" > nul || mariadbd.exe', {
            cwd: path.join(config.paths.services, 'mariadb', 'bin')
        }, (error, stdout, stderr) => {
            if (error && !error.killed) return reject(error)
            if (stderr && !stderr.includes('[Notice]')) return reject(stderr)
            resolve()
        })
    })
}

/**
 * Stop the service.
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
