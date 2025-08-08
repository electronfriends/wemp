import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import config from '../config.js';

const execute = promisify(exec);

/**
 * Base service class
 */
export class Service {
  /**
   * @param {Object} serviceConfig - Service configuration
   */
  constructor(serviceConfig) {
    this.id = serviceConfig.id;
    this.name = serviceConfig.name;
    this.version = serviceConfig.version;
    this.config = serviceConfig;
    this.process = null;
    this.servicePath = path.join(config.paths.services, this.id);
  }

  /**
   * Start the service
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.process) {
      this.process = this.createProcess();
    }

    const startPromise = this.process.start();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`${this.name} failed to start within timeout`)),
        config.timeouts.start
      );
    });

    await Promise.race([startPromise, timeoutPromise]);
  }

  /**
   * Stop the service
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.gracefulStop) {
      try {
        const gracefulPromise = this.gracefulStop();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Graceful stop timeout')), config.timeouts.stop);
        });

        await Promise.race([gracefulPromise, timeoutPromise]);
      } catch {
        // Fall back to force stop
      }
    }

    if (this.process) {
      const stopPromise = this.process.stop();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`${this.name} failed to stop within timeout`)),
          config.timeouts.stop
        );
      });

      await Promise.race([stopPromise, timeoutPromise]);
      this.process = null;
    }
  }

  /**
   * Restart the service
   * @returns {Promise<void>}
   */
  async restart() {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, config.timeouts.restart));
    await this.start();
  }

  /**
   * Check if service process is running
   * @returns {boolean}
   */
  isRunning() {
    return this.process && this.process.isRunning;
  }

  /**
   * Check if service process is running on the system
   * @returns {Promise<boolean>}
   */
  async isProcessRunning() {
    try {
      const executable = this.config.executable;
      const { stdout } = await execute(`tasklist /FI "IMAGENAME eq ${executable}" /NH`);
      return stdout.includes(executable);
    } catch {
      return false;
    }
  }

  /**
   * Create the process manager for this service
   * @returns {ProcessManager} Process manager instance
   * @throws {Error} Must be implemented by subclass
   */
  createProcess() {
    throw new Error(`Service ${this.name} must implement createProcess`);
  }
}
