import { exec } from 'child_process'
import path from 'path'

import config from '../config'
import { updateMenuStatus } from '../main-process/menu'
import * as logger from '../utils/logger'
import { onServiceError } from '../utils/notification'

const servicePath = path.join(config.paths.services, 'nginx')

/**
 * Start the service.
 */
export function start() {
    exec('tasklist | find /i "nginx.exe" > nul || nginx.exe', { cwd: servicePath }, (error, stdout, stderr) => {
        if (error) {
            updateMenuStatus('Nginx', false)
            return
        }

        if (stdout) logger.write(stdout)
        if (stderr) logger.write(stderr, onServiceError('Nginx'))
    })
}

/**
 * Stop the service.
 */
export function stop() {
    exec('taskkill /IM "nginx.exe" /F')
}
