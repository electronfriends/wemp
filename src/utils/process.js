import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import log from './logger';
import { onServiceError } from './notification';
import { updateMenuStatus } from '../core/menu';
import { appState } from '../main';

const execute = promisify(exec);

class Process {
  /**
   * Create a new process wrapper
   * @param {string} id - Process identifier (service id)
   * @param {string} displayName - Process display name
   * @param {string} executable - Executable name
   * @param {string[]} args - Command line arguments
   * @param {Object} options - Process options
   */
  constructor(id, displayName, executable, args, options) {
    this.id = id;
    this.displayName = displayName;
    this.executable = executable;
    this.args = args;
    this.options = options;
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
      log.error(`Failed to check if ${this.displayName} is running`, error);
      return false;
    }
  }

  /**
   * Force kill process using taskkill
   * @throws {Error} If taskkill command fails for reasons other than process not found.
   */
  async kill() {
    try {
      this.child?.kill();
      await execute(`taskkill /F /IM "${this.executable}"`);
    } catch (error) {
      if (error.code === 128) {
        // Process is not running, which is the desired state. Do not throw.
      } else {
        // For any other error, re-throw.
        throw new Error(`Failed to kill process ${this.displayName} (${this.executable}). Reason: ${error.message}`);
      }
    } finally {
      this.child = undefined;
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
      throw error;
    }
  }

  /**
   * Start the process and handle its lifecycle events
   * @returns {Promise<void>} Resolves when process is started
   */
  start() {
    return new Promise((resolve, reject) => {
      this.child = spawn(this.executable, this.args, this.options);

      this.child.stderr?.on('data', (data) => {
        log.warn(`[${this.displayName}] ${data}`);
      });

      this.child.on('error', (error) => {
        log.error(`[${this.displayName}] Process error`, error);
        reject(error);
      });

      this.child.on('close', () => {
        if (this.child.killed || appState.isQuitting) {
          return;
        }

        log.warn(`[${this.displayName}] Service stopped unexpectedly.`);
        updateMenuStatus(this.id, false);
        onServiceError(this.displayName);
      });

      this.child.on('spawn', resolve);
    });
  }
}

export default Process;
