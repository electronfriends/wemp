import { ChildProcess, exec } from 'child_process'
import path from 'path'

import config from '../config'

/**
 * The absolute path to the service.
 */
const servicePath: string = path.join(config.paths.services, 'php')

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
        process = exec('php-cgi.exe -b 127.0.0.1:9000', { cwd: servicePath }, error => {
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
        process.kill()

        exec('taskkill /IM "nginx.exe" /F', error => {
            if (error) return reject(error)
            resolve()
        })
    })
}
