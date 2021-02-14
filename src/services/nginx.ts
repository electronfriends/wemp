import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

import config from '../config'
import { updateMenuStatus } from '../main-process/menu'
import * as logger from '../utils/logger'
import { onServiceError } from '../utils/notification'

const servicePath = path.join(config.paths.services, 'nginx')

/**
 * Called when the service is first installed.
 */
export function install() {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(config.paths.stubs, 'nginx/nginx.conf'), (error, contents) => {
            if (error) return reject(error)
            fs.writeFile(path.join(servicePath, 'conf/nginx.conf'), contents, resolve)
        })
    })
}

/**
 * Start the service.
 */
export function start() {
    exec('tasklist | find /i "nginx.exe" || nginx.exe', { cwd: servicePath }, (error, stdout, stderr) => {
        if (error) updateMenuStatus('Nginx', false)
        if (stderr) logger.write(stderr, () => onServiceError('Nginx'))
    })
}

/**
 * Stop the service.
 */
export function stop() {
    exec('taskkill /IM "nginx.exe" /F')
}
