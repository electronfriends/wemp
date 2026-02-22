import { spawn } from 'node:child_process';
import path from 'node:path';

import config from '../config.js';
import logger from './logger.js';

/**
 * Executes a PowerShell command to modify user PATH
 * @param {string} command - PowerShell command to execute
 * @returns {Promise<string>} Command output
 * @private
 */
function executePathCommand(command) {
  return new Promise((resolve, reject) => {
    const powershell = spawn('powershell.exe', ['-NoProfile', '-Command', command], {
      windowsHide: true,
      stdio: 'pipe',
    });

    let output = '';
    let error = '';

    powershell.stdout?.on('data', data => {
      output += data.toString();
    });

    powershell.stderr?.on('data', data => {
      error += data.toString();
    });

    powershell.on('close', code => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`PowerShell command failed: ${error || 'Unknown error'}`));
      }
    });

    powershell.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Gets the current user PATH environment variable
 * @returns {Promise<string[]>} Array of paths in user PATH
 */
export async function getUserPath() {
  try {
    const result = await executePathCommand(
      '[Environment]::GetEnvironmentVariable("Path", "User")'
    );
    return result
      .split(';')
      .filter(p => p.trim())
      .map(p => p.trim());
  } catch (error) {
    logger.error('Failed to get user PATH:', error);
    throw error;
  }
}

/**
 * Sets the user PATH environment variable
 * @param {string[]} paths - Array of paths to set as user PATH
 * @returns {Promise<void>}
 * @private
 */
async function setUserPath(paths) {
  const pathString = paths.filter(p => p.trim()).join(';');
  const command = `[Environment]::SetEnvironmentVariable("Path", "${pathString}", "User")`;

  try {
    await executePathCommand(command);
    logger.info('Updated user PATH');
  } catch (error) {
    logger.error('Failed to set user PATH:', error);
    throw error;
  }
}

/**
 * Gets the service paths that should be added to PATH
 * @returns {string[]} Array of service executable paths
 */
export function getServicePaths() {
  const servicesPath = config.paths.services;

  return Object.entries(config.services).map(([serviceId, svc]) =>
    svc.executablePath
      ? path.join(servicesPath, serviceId, svc.executablePath)
      : path.join(servicesPath, serviceId)
  );
}

/**
 * Checks if service paths are in user PATH
 * @returns {Promise<boolean>} True if all service paths are in PATH
 */
export async function areServicePathsInPath() {
  try {
    const currentPath = await getUserPath();
    const servicePaths = getServicePaths();

    return servicePaths.every(servicePath =>
      currentPath.some(p => p.toLowerCase() === servicePath.toLowerCase())
    );
  } catch (error) {
    logger.error('Failed to check if service paths are in PATH:', error);
    return false;
  }
}

/**
 * Adds service paths to user PATH environment variable
 * @returns {Promise<void>}
 */
export async function addServicePathsToPath() {
  try {
    const currentPath = await getUserPath();
    const servicePaths = getServicePaths();
    const newPaths = [...currentPath];

    // Add paths that don't already exist
    servicePaths.forEach(servicePath => {
      if (!newPaths.some(p => p.toLowerCase() === servicePath.toLowerCase())) {
        newPaths.push(servicePath);
      }
    });

    await setUserPath(newPaths);
    logger.info('Service paths added to user PATH');
  } catch (error) {
    logger.error('Failed to add service paths to PATH:', error);
    throw error;
  }
}

/**
 * Removes service paths from user PATH environment variable
 * @returns {Promise<void>}
 */
export async function removeServicePathsFromPath() {
  try {
    const currentPath = await getUserPath();
    const servicePaths = getServicePaths();

    // Filter out service paths (case-insensitive)
    const newPaths = currentPath.filter(
      p => !servicePaths.some(sp => sp.toLowerCase() === p.toLowerCase())
    );

    await setUserPath(newPaths);
    logger.info('Service paths removed from user PATH');
  } catch (error) {
    logger.error('Failed to remove service paths from PATH:', error);
    throw error;
  }
}

/**
 * Toggles service paths in user PATH
 * @returns {Promise<boolean>} True if paths were added, false if removed
 */
export async function toggleServicePathsInPath() {
  const inPath = await areServicePathsInPath();

  if (inPath) {
    await removeServicePathsFromPath();
    return false;
  } else {
    await addServicePathsToPath();
    return true;
  }
}
