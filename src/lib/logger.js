import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import config from '../config.js';

/**
 * Application logger with file rotation and level-based output
 *
 * Provides colored console output in development and file-based logging in production.
 * Automatically rotates log files when size limit is reached.
 */
class Logger {
  constructor() {
    /** @type {string} Path to log file */
    this.logPath = config.paths.logs;
    /** @type {number} Maximum log file size in bytes */
    this.maxLogSize = config.logger.maxLogSize;
    /** @type {number} Maximum number of rotated log files to keep */
    this.maxLogFiles = config.logger.maxLogFiles;
    /** @type {boolean} Whether running in development mode */
    this.isDevelopment = !app.isPackaged;

    /** @type {Object.<string, string>} ANSI color codes for console output */
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      black: '\x1b[30m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      gray: '\x1b[90m',
    };

    this.ensureLogFile();
  }

  /**
   * Ensures the log directory exists
   * @private
   */
  ensureLogFile() {
    try {
      const dir = path.dirname(this.logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Formats a log message with timestamp and level
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {Error} [error] - Optional error object
   * @returns {string} Formatted log message
   * @private
   */
  formatMessage(level, message, error = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    if (error) {
      logMessage += `\nError: ${error.stack || error.message || error}`;
    }

    return logMessage;
  }

  /**
   * Formats a log message for console output with ANSI color codes
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {Error} [error] - Optional error object
   * @returns {string} Formatted colored log message
   * @private
   */
  formatConsoleMessage(level, message, error = null) {
    const timestamp = new Date().toISOString();
    const { colors } = this;

    const levelColors = {
      info: { level: `${colors.green}${colors.bright}INFO${colors.reset}`, msg: colors.cyan },
      warn: { level: `${colors.yellow}${colors.bright}WARN${colors.reset}`, msg: colors.yellow },
      error: { level: `${colors.red}${colors.bright}ERROR${colors.reset}`, msg: colors.red },
      debug: { level: `${colors.gray}DEBUG${colors.reset}`, msg: colors.gray },
    };

    const style = levelColors[level] || { level: level.toUpperCase(), msg: '' };
    const coloredMessage = `${style.msg}${message}${colors.reset}`;
    let logMessage = `${colors.gray}[${timestamp}]${colors.reset} ${style.level}: ${coloredMessage}`;

    if (error) {
      logMessage += `\n${colors.red}Error: ${error.stack || error.message || error}${colors.reset}`;
    }

    return logMessage;
  }

  /**
   * Rotates log files when the current log exceeds max size
   * Shifts existing rotated files and removes oldest if limit reached
   * @private
   */
  rotateLogIfNeeded() {
    try {
      if (!fs.existsSync(this.logPath)) return;

      const stats = fs.statSync(this.logPath);
      if (stats.size < this.maxLogSize) return;

      // Shift existing log files (newest to oldest)
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = `${this.logPath}.${i}`;
        const newFile = `${this.logPath}.${i + 1}`;

        if (fs.existsSync(oldFile)) {
          // Delete oldest log file if at limit
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Rotate current log to .1
      fs.renameSync(this.logPath, `${this.logPath}.1`);
    } catch {
      /* ignore */
    }
  }

  /**
   * Writes a message to the log file
   * @param {string} message - Message to write
   * @private
   */
  writeToFile(message) {
    try {
      this.rotateLogIfNeeded();
      fs.appendFileSync(this.logPath, message + '\n');
    } catch {
      /* ignore */
    }
  }

  /**
   * Logs info level message (console only in dev)
   * @param {string} message - Message to log
   * @param {...string} args - Additional arguments to append
   */
  info(message, ...args) {
    const fullMessage = args.length ? `${message} ${args.join(' ')}` : message;
    if (this.isDevelopment) {
      console.log(this.formatConsoleMessage('info', fullMessage));
    }
  }

  /**
   * Logs warning level message
   * @param {string} message - Message to log
   * @param {Error} [error] - Optional error object
   */
  warn(message, error = null) {
    const logMessage = this.formatMessage('warn', message, error);
    if (this.isDevelopment) {
      console.warn(this.formatConsoleMessage('warn', message, error));
    }
    this.writeToFile(logMessage);
  }

  /**
   * Logs error level message
   * @param {string} message - Message to log
   * @param {Error} [error] - Optional error object
   */
  error(message, error = null) {
    const logMessage = this.formatMessage('error', message, error);
    if (this.isDevelopment) {
      console.error(this.formatConsoleMessage('error', message, error));
    }
    this.writeToFile(logMessage);
  }

  /**
   * Logs debug level message (dev only)
   * @param {string} message - Message to log
   * @param {...string} args - Additional arguments to append
   */
  debug(message, ...args) {
    if (!this.isDevelopment) return;
    const fullMessage = args.length ? `${message} ${args.join(' ')}` : message;
    console.debug(this.formatConsoleMessage('debug', fullMessage));
  }
}

export default new Logger();
