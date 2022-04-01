import fs from 'fs'

import config from '../config'

// Clear the log file at each startup
fs.truncate(config.paths.logs, (error) => {
    if (error) {
        throw new Error('Could not truncate the log file: ' + error.message)
    }
})

/**
 * Write something to the log file.
 *
 * @param message - The message
 * @param callback - An optional callback
 */
export function write(message: string, callback?: Function): void {
    message = message.replace(/\r?\n|\r/g, '')

    const content = new Date().toISOString() + ' > ' + message + '\n'

    fs.appendFile(config.paths.logs, content, { flag: 'a' }, (error) => {
        if (error) {
            throw error
        }

        if (typeof callback === 'function') {
            callback()
        }
    })
}
