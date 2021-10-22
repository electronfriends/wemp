import { ChildProcess, exec } from 'child_process'
import path from 'path'

import config from '../config'

/**
 * The child process of the service.
 */
let process: ChildProcess

/**
 * Start the service.
 */
export function start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        process = exec('tasklist | find /i "nginx.exe" > nul || nginx.exe', {
            cwd: path.join(config.paths.services, 'nginx')
        }, (error, stdout, stderr) => {
            if (error && !error.killed) return reject(error)
            if (stderr) return reject(stderr)
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

        exec('taskkill /IM "nginx.exe" /F', (error) => {
            if (error) return reject(error)
            resolve()
        })
    })
}
