import fs from 'node:fs';

import config from '../config';

const LOG_RETENTION_DAYS = 7;

class Logger {
  /**
   * Create a new logger instance
   * @param {string} logPath - Path to log file
   */
  constructor(logPath) {
    this.logPath = logPath;
    this.#initializeLogFile();
  }

  /**
   * Initializes the log file by trimming old entries.
   * @private
   */
  #initializeLogFile() {
    try {
      if (!fs.existsSync(this.logPath)) {
        return;
      }

      const originalContent = fs.readFileSync(this.logPath, 'utf-8');
      if (!originalContent.trim()) {
        return;
      }

      const lines = originalContent.split('\n');
      const retainedLogLines = [];
      let currentEntryHeaderTimestamp = null;
      const cutoffTimestamp = Date.now() - (LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);

      // Regex captures content within the first pair of square brackets.
      const logEntryHeaderRegex = /^\[(.*?)\]/;

      for (const line of lines) {
        if (!line && retainedLogLines.length === 0) continue;

        const match = line.match(logEntryHeaderRegex);
        if (match) {
          const timestampString = match[1];
          try {
            const entryTimestamp = new Date(timestampString).getTime();
            if (!isNaN(entryTimestamp) && entryTimestamp >= cutoffTimestamp) {
              currentEntryHeaderTimestamp = entryTimestamp;
              retainedLogLines.push(line);
            } else {
              currentEntryHeaderTimestamp = null;
            }
          } catch (e) {
            currentEntryHeaderTimestamp = null;
          }
        } else {
          if (currentEntryHeaderTimestamp !== null) {
            retainedLogLines.push(line);
          }
        }
      }

      let newContent = retainedLogLines.join('\n');
      if (retainedLogLines.length > 0 && retainedLogLines.some(line => line.trim() !== '') && !newContent.endsWith('\n')) {
        newContent += '\n';
      } else if (retainedLogLines.filter(line => line.trim() !== '').length === 0) {
        newContent = '';
      }

      // Only write if content has actually changed or if it was all whitespace and now correctly empty.
      if (newContent !== originalContent || (originalContent.trim() === '' && newContent === '')) {
        fs.writeFileSync(this.logPath, newContent);
      }
    } catch (err) {
      console.error('Failed to initialize log file:', err);
      this.clear();
    }
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
    try {
      fs.writeFileSync(this.logPath, '');
    } catch (err) {
      console.error('Failed to clear log file:', err);
    }
  }
}

const log = new Logger(config.paths.logs);
export default log;
