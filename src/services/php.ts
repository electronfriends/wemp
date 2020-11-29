import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import config from '../config'
import { onServiceStopped } from '../utils/notification'

const servicePath = path.join(config.paths.services, 'php')

/**
 * Called when the service is first installed.
 */
export async function install() {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(config.paths.stubs, 'php/php.ini'), (error, contents) => {
            if (error) return reject(error)
            fs.writeFile(path.join(config.paths.services, 'php/php.ini'), contents, resolve)
        })
    })
}

/**
 * Start the service.
 */
export function start() {
    exec('tasklist | find /i "php-cgi.exe" || php-cgi.exe -b 127.0.0.1:9000', { cwd: servicePath }, (error) => {
        if (error) onServiceStopped('PHP')
    })
}

/**
 * Stop the service.
 */
export function stop() {
    exec('taskkill /IM "php-cgi.exe" /F')
}