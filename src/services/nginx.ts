import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import config from '../config'
import { onServiceStopped } from '../utils/notification'

const servicePath = path.join(config.paths.services, 'nginx')

/**
 * Called when the service is first installed.
 */
export async function install() {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(config.paths.stubs, 'nginx/nginx.conf'), (error, contents) => {
            if (error) return reject(error)
            fs.writeFile(path.join(config.paths.services, 'nginx/conf/nginx.conf'), contents, resolve)
        })
    })
}

/**
 * Start the service.
 */
export function start() {
    exec('tasklist | find /i "nginx.exe" || nginx.exe', { cwd: servicePath }, (error) => {
        if (error) onServiceStopped('Nginx')
    })
}

/**
 * Stop the service.
 */
export function stop() {
    exec('taskkill /IM "nginx.exe" /F')
}