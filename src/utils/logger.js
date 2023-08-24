import fs from 'fs';

import config from '../config';

const logFilePath = config.paths.logs;

/**
 * Log a message to the log file.
 * @param {string} message - The message to be logged.
 */
export default function logger(message) {
  const timestamp = new Date().toLocaleString();
  const sanitizedMessage = message.replace(/[\r\n]+/g, ' ');
  const logMessage = `[${timestamp}] ${sanitizedMessage}\n`;

  fs.appendFileSync(logFilePath, logMessage);
}

// Clear the log file when the application is started.
fs.writeFileSync(logFilePath, '');
