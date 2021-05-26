import { exec } from 'child_process'
import path from 'path'

import config from '../config'
import { updateMenuStatus } from '../main-process/menu'
import * as logger from '../utils/logger'
import { onServiceError } from '../utils/notification'

const servicePath = path.join(config.paths.services, 'php')

/**
 * Start the service.
 */
export function start() {
    exec('tasklist | find /i "php-cgi.exe" > nul || php-cgi.exe -b 127.0.0.1:9000', { cwd: servicePath }, (error, stdout, stderr) => {
        if (error) {
            logger.write(error, updateMenuStatus('PHP', false))
            return
        }

        if (stdout) logger.write(stdout)
        if (stderr) logger.write(stderr, onServiceError('PHP'))
    })
}

/**
 * Stop the service.
 */
export function stop() {
    exec('taskkill /IM "php-cgi.exe" /F')
}
