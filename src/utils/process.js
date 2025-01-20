import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import log from './logger';
import { onServiceError } from './notification';
import { updateMenuStatus } from '../core/menu';

const execute = promisify(exec);

class Process {
  /**
   * Create a new process wrapper
   * @param {string} name - Process display name
   * @param {string} executable - Executable name
   * @param {string[]} args - Command line arguments
   * @param {Object} options - Process options
   * @param {boolean} restartOnClose - Whether to restart on unexpected close
   */
  constructor(name, executable, args, options, restartOnClose = false) {
    this.name = name;
    this.executable = executable;
    this.args = args;
    this.options = options;
    this.restartOnClose = restartOnClose;
    this.child = undefined;
  }

  /**
   * Check if process is running using Windows tasklist
   * @returns {Promise<boolean>} Whether the process is running
   */
  async isRunning() {
    try {
      const { stdout } = await execute('tasklist');
      return stdout.includes(this.executable);
    } catch (error) {
      log.error(`Failed to check if ${this.name} is running`, error);
      return false;
    }
  }

  /**
   * Force kill process using taskkill
   */
  async kill() {
    try {
      this.child?.kill();
      await execute(`taskkill /F /IM "${this.executable}"`);
    } catch (error) {
      log.error(`Failed to kill ${this.name}`, error);
    }
  }

  /**
   * Start or restart the process
   * @throws {Error} If the process fails to start
   */
  async run() {
    try {
      if (await this.isRunning()) {
        await this.kill();
      }
      await this.start();
    } catch (error) {
      log.error(`Failed to start ${this.name}`, error);
      throw error;
    }
  }

  /**
   * Start the process and handle its lifecycle events
   * @returns {Promise<void>} Resolves when process is started
   * @throws {Error} If the process fails to start
   */
  start() {
    return new Promise((resolve, reject) => {
      this.child = spawn(this.executable, this.args, this.options);

      this.child.stderr?.on('data', (data) => {
        log.warn(`[${this.name}] ${data}`);
      });

      this.child.on('error', (error) => {
        log.error(`[${this.name}] Process error`, error);
        reject(error);
      });

      this.child.on('close', () => {
        if (!this.child.killed) {
          if (this.restartOnClose) {
            this.run().catch(error =>
              log.error(`Failed to restart ${this.name}`, error)
            );
          } else {
            updateMenuStatus(this.name, false);
            onServiceError(this.name);
          }
        }
      });

      this.child.on('spawn', resolve);
    });
  }
}

export default Process;
