import { exec, spawn } from 'child_process';
import { promisify } from 'util';

import { updateMenuStatus } from '../main-process/menu';
import logger from '../utils/logger';
import { onServiceError } from './notification';

const execPromise = promisify(exec);

class Process {
  constructor(name, executable, args, options, restartOnClose = false) {
    this.name = name;
    this.executable = executable;
    this.args = args;
    this.options = options;
    this.restartOnClose = restartOnClose;
    this.child = undefined;
  }

  async isRunning() {
    try {
      const { stdout } = await execPromise('tasklist');
      return stdout.includes(this.executable);
    } catch (error) {
      logger(`Failed to check if process is running: ${error.message}`);
      return false;
    }
  }

  async kill() {
    this.child?.kill();

    try {
      await execPromise(`taskkill /F /IM "${this.executable}"`);
    } catch (error) {
      logger(`Failed to kill process: ${error.message}`);
    }
  }

  async run() {
    try {
      const isRunning = await this.isRunning();

      if (isRunning) {
        await this.kill();
      }

      await this.start();
    } catch (error) {
      logger(`Failed to start process: ${error.message}`);
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      this.child = spawn(this.executable, this.args, this.options);

      const dataHandler = (data) => {
        logger(`[${this.name}] ${data}`);
      };

      const errorHandler = (error) => {
        logger(`[${this.name}] Error: ${error.message}`);
        reject(error);
      };

      const closeHandler = () => {
        if (this.child.killed) {
          return;
        }

        if (this.restartOnClose) {
          this.run(true);
          return;
        }

        updateMenuStatus(this.name, false);
        onServiceError(this.name);
      };

      const spawnHandler = () => {
        resolve();
      };

      this.child.stderr?.on('data', dataHandler);
      this.child.on('error', errorHandler);
      this.child.on('close', closeHandler);
      this.child.on('spawn', spawnHandler);
    });
  }
}

export default Process;
