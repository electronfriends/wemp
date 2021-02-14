import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

import config from '../config'
import { updateMenuStatus } from '../main-process/menu'
import * as logger from '../utils/logger'
import { onServiceError } from '../utils/notification'

const servicePath = path.join(config.paths.services, 'php')

/**
 * Called when the service is first installed.
 */
export function install() {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(config.paths.stubs, 'php/php.ini'), (error, contents) => {
            if (error) return reject(error)
            fs.writeFile(path.join(servicePath, 'php.ini'), contents, resolve)
        })
    })
}

/**
 * Start the service.
 */
export function start() {
    exec('tasklist | find /i "php-cgi.exe" || php-cgi.exe -b 127.0.0.1:9000', { cwd: servicePath }, (error, stdout, stderr) => {
        if (error) updateMenuStatus('PHP', false)
        if (stderr) logger.write(stderr, () => onServiceError('PHP'))
    })
}

/**
 * Stop the service.
 */
export function stop() {
    exec('taskkill /IM "php-cgi.exe" /F')
}
