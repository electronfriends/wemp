import { app } from 'electron'
import fs from 'fs'
import path from 'path'

import config from '../config'

/**
 * Path to the error log file.
 */
export const errorPath = path.join(app.getPath('userData'), 'error.log')

/**
 * Write to the log file.
 *
 * @param message
 * @param callback
 */
export function write(message, callback) {
    fs.appendFile(errorPath, message + '\r\n', callback)
}

/**
 * Write synchronously to the log file.
 *
 * @param message
 */
export async function writeSync(message) {
    fs.appendFileSync(errorPath, message + '\r\n')
}
