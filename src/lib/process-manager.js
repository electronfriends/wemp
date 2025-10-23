import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';

import config from '../config.js';
import logger from './logger.js';
import * as notifications from './notifications.js';

/**
 * Manages process lifecycle for services
 *
 * Handles Windows-specific process management with proper cleanup and monitoring.
 * Extends EventEmitter to notify about process state changes.
 *
 * @fires ProcessManager#process-started
 * @fires ProcessManager#process-stopped
 */
export class ProcessManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, ChildProcess>} Active service processes */
    this.processes = new Map();
    /** @type {boolean} Whether the application is shutting down */
    this.isShuttingDown = false;
    /** @type {Set<string>} Services currently being stopped */
    this.stoppingServices = new Set();
  }

  /**
   * Starts a service process with proper configuration
   * @param {string} serviceId - Service identifier
   * @param {string} servicePath - Path to service installation
   * @returns {Promise<void>}
   */
  async startProcess(serviceId, servicePath) {
    if (this.processes.has(serviceId)) {
      throw new Error(`${serviceId} is already running`);
    }

    const serviceConfig = config.services[serviceId];
    if (!serviceConfig) {
      throw new Error(`Unknown service: ${serviceId}`);
    }

    const executablePath = this.getExecutablePath(serviceConfig, servicePath);

    if (!fs.existsSync(executablePath)) {
      throw new Error(`${serviceConfig.name} is not installed. Please install services first.`);
    }

    // Prevent starting duplicate instances (e.g., from previous crashes or manual starts)
    const isRunning = await this.isExecutableRunning(serviceConfig.executable);
    if (isRunning) {
      const message = `is already running (possibly from a previous session or another instance)`;
      logger.warn(`${serviceConfig.name} ${message}`);
      notifications.showServiceError(serviceConfig.name, message);
      throw new Error(`${serviceConfig.name} ${message}`);
    }

    const childProcess = spawn(executablePath, serviceConfig.processArgs || [], {
      cwd: servicePath,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        ...serviceConfig.env,
      },
    });

    this.setupProcessHandlers(serviceId, childProcess);
    this.processes.set(serviceId, childProcess);

    this.emit('process-started', serviceId);
    logger.info(`Started ${serviceConfig.name}`);
  }

  /**
   * Stops a service process gracefully
   * @param {string} serviceId - Service identifier
   * @param {string} servicePath - Path to service installation
   * @returns {Promise<void>}
   */
  async stopProcess(serviceId, servicePath) {
    if (!this.processes.has(serviceId)) return;

    this.stoppingServices.add(serviceId);

    try {
      // MariaDB requires special shutdown via mysqladmin
      await (serviceId === 'mariadb'
        ? this.stopMariaDB(servicePath)
        : this.terminateProcess(serviceId));
    } catch (error) {
      logger.warn(`Failed to gracefully stop ${serviceId}, forcing termination:`, error);

      // Attempt force termination as fallback
      await this.terminateProcess(serviceId).catch(err =>
        logger.error(`Force termination also failed for ${serviceId}:`, err)
      );
    }

    logger.info(`Stopped ${config.services[serviceId]?.name || serviceId}`);
  }

  /**
   * Restarts a service process
   * @param {string} serviceId - Service identifier
   * @param {string} servicePath - Path to service installation
   * @returns {Promise<void>}
   * @throws {Error} If service is already being restarted
   */
  async restartProcess(serviceId, servicePath) {
    // Prevent concurrent restarts of the same service
    const restartKey = `restarting-${serviceId}`;
    if (this.stoppingServices.has(restartKey)) {
      throw new Error(`${serviceId} is already being restarted`);
    }

    this.stoppingServices.add(restartKey);
    try {
      // Validate nginx config before restarting
      if (serviceId === 'nginx') {
        await this.validateNginxConfig(servicePath);
      }

      await this.stopProcess(serviceId, servicePath);
      await this.startProcess(serviceId, servicePath);
    } finally {
      this.stoppingServices.delete(restartKey);
    }
  }

  /**
   * Validates nginx configuration before restart
   * @param {string} servicePath - Nginx installation path
   * @returns {Promise<void>}
   * @throws {Error} If configuration is invalid
   * @private
   */
  validateNginxConfig(servicePath) {
    const nginxPath = this.getExecutablePath(config.services.nginx, servicePath);

    return new Promise((resolve, reject) => {
      const test = spawn(nginxPath, ['-t'], {
        cwd: servicePath,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stderr = '';
      test.stderr.on('data', data => (stderr += data.toString()));

      test.on('exit', code =>
        code === 0
          ? resolve()
          : (logger.error(`Nginx configuration test failed:\n${stderr}`),
            reject(
              new Error(
                'Nginx configuration is invalid, not restarting to prevent breaking the server'
              )
            ))
      );

      test.on('error', err => {
        reject(err);
      });
    });
  }

  /**
   * Stops all running processes during shutdown
   * @returns {Promise<void>}
   */
  async stopAllProcesses() {
    this.isShuttingDown = true;
    const runningServices = Array.from(this.processes.keys());

    // Stop services in reverse order with parallel execution
    const stopPromises = runningServices.reverse().map(async serviceId => {
      try {
        const servicePath = path.join(config.paths.services, serviceId);
        await this.stopProcess(serviceId, servicePath);
      } catch (error) {
        logger.error(`Failed to stop ${serviceId}:`, error);
      }
    });

    // Wait for all stop operations to complete
    await Promise.allSettled(stopPromises);

    this.isShuttingDown = false;
  }

  /**
   * Checks if a service process is running
   * @param {string} serviceId - Service identifier
   * @returns {boolean}
   */
  isProcessRunning(serviceId) {
    return this.processes.has(serviceId);
  }

  /**
   * Gets the status of all processes
   * @returns {Object<string, boolean>} Status map of all services (serviceId -> isRunning)
   */
  getProcessStatus() {
    const status = {};
    for (const serviceId of Object.keys(config.services)) {
      // phpMyAdmin is not a process - it's running when its dependencies are
      if (serviceId === 'phpmyadmin') {
        status[serviceId] =
          this.isProcessRunning('nginx') &&
          this.isProcessRunning('mariadb') &&
          this.isProcessRunning('php');
      } else {
        status[serviceId] = this.isProcessRunning(serviceId);
      }
    }
    return status;
  }

  /**
   * Gets the executable path for a service
   * @param {Object} serviceConfig - Service configuration
   * @param {string} servicePath - Service installation path
   * @returns {string} Full path to executable
   * @private
   */
  getExecutablePath(serviceConfig, servicePath) {
    return serviceConfig.executablePath
      ? path.join(servicePath, serviceConfig.executablePath, serviceConfig.executable)
      : path.join(servicePath, serviceConfig.executable);
  }

  /**
   * Sets up process event handlers for monitoring and crash detection
   * @param {string} serviceId - Service identifier
   * @param {ChildProcess} childProcess - The spawned process
   * @private
   */
  setupProcessHandlers(serviceId, childProcess) {
    const MAX_BUFFER = 10000;
    const BUFFER_THRESHOLD = 9000; // Start trimming at 90% capacity
    const buffers = { stdout: '', stderr: '' };

    // Helper to handle stream output with buffer limits to prevent memory leaks
    const handleStream = (stream, type) => {
      childProcess[stream]?.on('data', data => {
        const chunk = data.toString();
        buffers[type] += chunk;

        // Trim old output when approaching limit to prevent unbounded growth
        if (buffers[type].length > BUFFER_THRESHOLD) {
          buffers[type] = buffers[type].slice(-MAX_BUFFER);
        }

        logger[type === 'stdout' ? 'info' : 'error'](`${serviceId} ${stream}:`, chunk);
      });
    };

    handleStream('stdout', 'stdout');
    handleStream('stderr', 'stderr');

    // Handle process exit
    childProcess.on('exit', code => {
      const wasStopping = this.stoppingServices.has(serviceId);

      this.processes.delete(serviceId);
      this.stoppingServices.delete(serviceId);

      // Clear buffers to free memory
      buffers.stdout = '';
      buffers.stderr = '';

      // Only treat as crash if exit was unexpected and unintentional
      if (code !== 0 && !this.isShuttingDown && !wasStopping) {
        const serviceName = config.services[serviceId]?.name || serviceId;
        logger.error(`${serviceName} crashed with exit code ${code}`);
        notifications.showServiceCrashed(serviceName);
      }

      this.emit('process-stopped', serviceId);
    });

    // Handle spawn errors
    childProcess.on('error', error => {
      logger.error(`${serviceId} process error:`, error);
      this.processes.delete(serviceId);
      this.stoppingServices.delete(serviceId);

      // Clear buffers to free memory
      buffers.stdout = '';
      buffers.stderr = '';

      this.emit('process-stopped', serviceId);
    });
  }

  /**
   * Stops MariaDB using mysqladmin shutdown command
   * @param {string} servicePath - MariaDB installation path
   * @returns {Promise<void>}
   * @throws {Error} If mysqladmin not found or shutdown fails
   * @private
   */
  async stopMariaDB(servicePath) {
    const mysqladminPath = path.join(servicePath, 'bin', 'mysqladmin.exe');
    if (!fs.existsSync(mysqladminPath)) {
      throw new Error('mysqladmin.exe not found');
    }

    return new Promise((resolve, reject) => {
      const shutdownProcess = spawn(mysqladminPath, ['-u', 'root', 'shutdown'], {
        cwd: servicePath,
        stdio: 'ignore',
        windowsHide: true,
      });

      // Set timeout for shutdown operation
      const timeout = setTimeout(() => {
        shutdownProcess.kill();
        reject(new Error('MariaDB shutdown timeout'));
      }, config.timeout.stop);

      shutdownProcess.on('exit', code => {
        clearTimeout(timeout);
        if (code === 0) {
          // Wait for process exit event or timeout
          this.waitForProcessExit('mariadb').then(resolve).catch(reject);
        } else {
          reject(new Error(`mysqladmin shutdown failed with code ${code}`));
        }
      });

      shutdownProcess.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Executes Windows taskkill command
   * @param {string[]} args - Arguments for taskkill
   * @returns {Promise<number>} Exit code
   * @private
   */
  executeTaskkill(args) {
    return new Promise((resolve, reject) => {
      const killProcess = spawn('taskkill', args, { stdio: 'ignore', windowsHide: true });
      killProcess.on('exit', resolve);
      killProcess.on('error', reject);
    });
  }

  /**
   * Terminates a process using Windows taskkill by executable name
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   * @throws {Error} If taskkill fails (except process not found)
   * @private
   */
  async terminateProcess(serviceId) {
    const serviceConfig = config.services[serviceId];
    if (!serviceConfig) return;

    const code = await this.executeTaskkill(['/F', '/IM', serviceConfig.executable]);

    // Exit code 128 means process not found, which is acceptable during shutdown
    if (code !== 0 && code !== 128) {
      throw new Error(`taskkill failed with code ${code}`);
    }

    // Wait for proper cleanup via exit event
    await this.waitForProcessExit(serviceId);
  }

  /**
   * Waits for a process to exit and ensures cleanup
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   * @private
   */
  async waitForProcessExit(serviceId) {
    const childProcess = this.processes.get(serviceId);

    // If process is already gone, cleanup and return
    if (!childProcess) {
      this.processes.delete(serviceId);
      this.stoppingServices.delete(serviceId);
      return;
    }

    // If process already exited, cleanup immediately
    if (childProcess.exitCode !== null || childProcess.killed) {
      this.processes.delete(serviceId);
      this.stoppingServices.delete(serviceId);
      return;
    }

    return new Promise(resolve => {
      // Set timeout to force cleanup if exit event doesn't fire
      const timeout = setTimeout(() => {
        logger.warn(`Process exit event timeout for ${serviceId}, forcing cleanup`);
        this.processes.delete(serviceId);
        this.stoppingServices.delete(serviceId);
        resolve();
      }, config.timeout.stop);

      // Wait for exit event
      const onExit = () => {
        clearTimeout(timeout);
        resolve();
      };

      childProcess.once('exit', onExit);
    });
  }

  /**
   * Checks if a process with the given executable name is currently running
   * @param {string} executableName - Name of the executable (e.g., 'mysqld.exe')
   * @returns {Promise<boolean>} True if process is running
   * @private
   */
  async isExecutableRunning(executableName) {
    return new Promise(resolve => {
      const tasklist = spawn('tasklist', ['/FI', `IMAGENAME eq ${executableName}`, '/NH'], {
        stdio: 'pipe',
        windowsHide: true,
      });

      let output = '';
      tasklist.stdout?.on('data', data => {
        output += data.toString();
      });

      tasklist.on('close', () => {
        const lines = output.split('\n').filter(line => line.trim());
        const isRunning = lines.some(line =>
          line.toLowerCase().trim().startsWith(executableName.toLowerCase())
        );
        logger.debug(`Checking if ${executableName} is running: ${isRunning}`);
        resolve(isRunning);
      });

      tasklist.on('error', err => {
        logger.error(`Error checking if ${executableName} is running:`, err);
        resolve(false);
      });
    });
  }

  /**
   * Starts a service
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  startService(serviceId) {
    return this.startProcess(serviceId, path.join(config.paths.services, serviceId));
  }

  /**
   * Stops a service
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  stopService(serviceId) {
    return this.stopProcess(serviceId, path.join(config.paths.services, serviceId));
  }

  /**
   * Restarts a service
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  restartService(serviceId) {
    return this.restartProcess(serviceId, path.join(config.paths.services, serviceId));
  }

  /**
   * Starts all services
   * @returns {Promise<void>}
   */
  async startAll() {
    for (const serviceId of Object.keys(config.services)) {
      if (serviceId === 'phpmyadmin') continue;
      try {
        await this.startService(serviceId);
      } catch (error) {
        logger.error(`Failed to start ${serviceId}:`, error);
      }
    }
  }

  /**
   * Stops all running processes
   * @returns {Promise<void>}
   */
  stopAll() {
    return this.stopAllProcesses();
  }
}
