import fs from 'fs'

import config from '../config'

/**
 * Create a write stream for the log file.
 */
const stream = fs.createWriteStream(config.paths.logs)

/**
 * Write something to the log file.
 *
 * @param message The message.
 * @param callback Callback that should be executed after writing.
 * @returns {void}
 */
export function write(message: any, callback?: any): void {
    const msg = new Date().toISOString() + '  ' + message + '\n'

    if (typeof callback === 'function') {
        stream.on('finish', callback)
    }

    stream.write(msg)
}
