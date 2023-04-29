import fs from 'fs'

import config from '../config'

// Empty the contents of the log file at each startup
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
export function write(message: string, callback?: () => void): void {
  // Remove line breaks from the message
  message = message.replace(/\r?\n|\r/g, '')

  const content = `<${new Date().toLocaleString()}> ${message}\n`

  fs.appendFile(config.paths.logs, content, { flag: 'a' }, (error) => {
    if (error) {
      throw error
    }

    if (typeof callback === 'function') {
      callback()
    }
  })
}
