import { ChildProcess, exec } from 'child_process'
import path from 'path'

import config from '../config'

/**
 * The child process of the service.
 */
let process: ChildProcess

/**
 * Start the service.
 *
 * @returns {Promise}
 */
export function start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        process = exec('tasklist | find /i "php-cgi.exe" > nul || php-cgi.exe -b 127.0.0.1:9000', {
            cwd: path.join(config.paths.services, 'php')
        }, (error) => {
            if (error && !error.killed) return reject(error)
            resolve()
        })
    })
}

/**
 * Stop the service.
 * @returns {Promise}
 */
export function stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (process) process.kill()

        exec('taskkill /IM "php-cgi.exe" /F', (error) => {
            if (error) return reject(error)
            resolve()
        })
    })
}
