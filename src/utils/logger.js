import fs from 'node:fs';

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

  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
  });
}

// Clear the log file when the application is started.
fs.writeFile(logFilePath, '', (err) => {
  if (err) {
    console.error('Error clearing log file:', err);
  }
});
