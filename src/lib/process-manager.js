import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import config from '../config.js';

const execute = promisify(exec);

/**
 * Utility function for delays
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Simple process manager for managing service processes
 */
export class ProcessManager {
  /**
   * @param {string} name - Process name
   * @param {string} executable - Executable name
   * @param {string[]} args - Command line arguments
   * @param {Object} options - Process options
   */
  constructor(name, executable, args = [], options = {}) {
    this.name = name;
    this.executable = executable;
    this.args = args;
    this.options = options;
    this.process = null;
    this.isRunning = false;
    this.intentionallyKilled = false;
    this.onUnexpectedExit = null;
  }

  /**
   * Start the process
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) return;

    this.process = spawn(this.executable, this.args, {
      stdio: 'pipe',
      windowsHide: true,
      detached: false,
      ...this.options,
    });

    this.isRunning = true;

    this.process.on('error', () => {
      this.isRunning = false;
    });

    this.process.on('exit', (code, signal) => {
      const wasIntentional = this.intentionallyKilled;
      this.isRunning = false;
      this.intentionallyKilled = false;

      // Only trigger callback for unexpected exits (crashes, not manual stops)
      if (!wasIntentional && this.onUnexpectedExit) {
        this.onUnexpectedExit(code, signal);
      }
    });
  }

  /**
   * Stop the process
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) return;

    try {
      this.intentionallyKilled = true;

      if (this.process?.pid) {
        this.process.kill('SIGTERM');
        await sleep(config.timeouts.poll);
      }

      if (await this.checkRunning()) {
        await this.forceKill();
      }
    } catch {
      // Ignore errors during shutdown
    } finally {
      this.isRunning = false;
      this.process = null;
    }
  }

  /**
   * Force kill the process using taskkill
   * @returns {Promise<void>}
   */
  async forceKill() {
    try {
      this.intentionallyKilled = true;
      await execute(`taskkill /F /IM "${this.executable}" 2>nul`);
    } catch {
      // Process not found or already stopped
    }
  }

  /**
   * Check if process is running using tasklist
   * @returns {Promise<boolean>} True if process is running
   */
  async checkRunning() {
    try {
      const { stdout } = await execute(`tasklist /FI "IMAGENAME eq ${this.executable}" /NH`);
      return stdout.includes(this.executable);
    } catch {
      return false;
    }
  }

  /**
   * Set callback for unexpected process exits
   * @param {Function} callback - Callback function with (code, signal) parameters
   */
  setUnexpectedExitCallback(callback) {
    this.onUnexpectedExit = callback;
  }
}
