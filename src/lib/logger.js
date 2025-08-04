import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import config from '../config.js';

/**
 * Logger class for handling application logging
 */
class Logger {
  /**
   * Initialize logger with log file path and cleanup
   */
  constructor() {
    this.logPath = config.paths.logs;
    this.ensureLogFile();
    this.cleanupOldLogs();
  }

  /**
   * Ensure log file exists
   */
  ensureLogFile() {
    try {
      const dir = path.dirname(this.logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.logPath, '', { flag: 'a' });
    } catch {
      // Silent fail
    }
  }

  /**
   * Clean up old log entries to prevent file from growing too large
   */
  cleanupOldLogs() {
    try {
      if (!fs.existsSync(this.logPath)) return;

      const content = fs.readFileSync(this.logPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      if (lines.length <= 1000) return; // Keep last 1000 lines

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep last 7 days

      const filteredLines = lines.filter(line => {
        const match = line.match(/^\[(.+?)\]/);
        if (!match) return true;

        try {
          const logDate = new Date(match[1]);
          return logDate >= cutoffDate;
        } catch {
          return true;
        }
      });

      if (filteredLines.length < lines.length) {
        fs.writeFileSync(this.logPath, filteredLines.join('\n') + '\n');
      }
    } catch {
      // Silent fail
    }
  }

  /**
   * Log a message with specified level
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Message to log
   * @param {Error} [error] - Optional error object
   */
  log(level, message, error) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    if (error) {
      const errorInfo = error.stack || error.message || String(error);
      const fullEntry = `${logEntry}\n${errorInfo}\n`;

      try {
        fs.appendFileSync(this.logPath, fullEntry);
      } catch {
        // Silent fail
      }
    } else {
      try {
        fs.appendFileSync(this.logPath, `${logEntry}\n`);
      } catch {
        // Silent fail
      }
    }

    // Also log to console in development (when app is not packaged)
    if (!app.isPackaged) {
      if (level === 'error') {
        console.error(message, error || '');
      } else {
        console.log(`${level.toUpperCase()}: ${message}`);
      }
    }
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   */
  info(message) {
    this.log('info', message);
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {Error} [error] - Optional error object
   */
  warn(message, error) {
    this.log('warn', message, error);
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {Error} [error] - Optional error object
   */
  error(message, error) {
    this.log('error', message, error);
  }
}

export default new Logger();
