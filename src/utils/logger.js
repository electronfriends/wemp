import fs from 'node:fs';

import config from '../config';

class Logger {
  /**
   * Create a new logger instance
   * @param {string} logPath - Path to log file
   */
  constructor(logPath) {
    this.logPath = logPath;
    this.clear();
  }

  /**
   * Write message to log file with timestamp and optional stack trace
   * @private
   */
  async #write(level, message, error = null) {
    try {
      const timestamp = new Date().toISOString();
      let logMessage = `[${timestamp}] ${level}: ${message}`;

      if (error?.stack) {
        logMessage += `\nStack trace:\n${error.stack}`;
      }

      await fs.promises.appendFile(this.logPath, logMessage + '\n');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  /**
   * Log informational message
   * @param {string} message - Message to log
   */
  info(message) {
    return this.#write('INFO', message);
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   */
  warn(message) {
    return this.#write('WARN', message);
  }

  /**
   * Log error message with optional error object
   * @param {string} message - Message to log
   * @param {Error} [error] - Error object with stack trace
   */
  error(message, error = null) {
    return this.#write('ERROR', message, error);
  }

  /**
   * Clear log file contents
   */
  clear() {
    fs.writeFileSync(this.logPath, '');
  }
}

const log = new Logger(config.paths.logs);
export default log;
