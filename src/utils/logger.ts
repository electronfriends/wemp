import fs from 'fs'

import config from '../config'

/**
 * Create a write stream for the log file.
 */
const stream = fs.createWriteStream(config.paths.logs)

/**
 * Write to the log file.
 *
 * @param message Message
 * @param callback Optional callback
 */
export function write(message, callback?) {
    const msg = new Date().toISOString() + ' : ' + message + '\n'

    if (callback) {
        stream.on('finish', callback)
    }

    stream.write(msg)
}
