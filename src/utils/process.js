import { exec, execSync, spawn } from 'child_process';

import { updateMenuStatus } from '../main-process/menu';
import logger from '../utils/logger';
import { onServiceError } from './notification';

class Process {
  constructor(name, executable, args, options) {
    this.name = name;
    this.executable = executable;
    this.args = args;
    this.options = options;
    this.child = undefined;
  }

  async isRunning() {
    try {
      const stdout = await new Promise((resolve, reject) => {
        exec('tasklist', (error, stdout) => {
          if (error) {
            reject(error);
          }
          resolve(stdout);
        });
      });

      return stdout.includes(this.executable);
    } catch (error) {
      logger(`Failed to check if process is running: ${error.message}`);
    }
  }

  async kill() {
    if (!this.child) {
      return;
    }

    this.child.kill();

    try {
      execSync(`taskkill /IM "${this.executable}" /F`);
    } catch (error) {
      logger(`Failed to kill process: ${error.message}`);
    }
  }

  async run(restartOnClose = false) {
    try {
      const isRunning = await this.isRunning();

      if (isRunning) {
        await this.kill();
      }

      await new Promise((resolve, reject) => {
        this.child = spawn(this.executable, this.args, this.options);

        this.child.stderr?.on('data', (data) => {
          logger(`[${this.name}] ${data}`);
        });

        this.child.on('close', () => {
          if (this.child.killed) {
            return;
          }

          if (restartOnClose) {
            this.run(true);
            return;
          }

          updateMenuStatus(this.name, false);
          onServiceError(this.name);
        });

        this.child.on('error', (error) => {
          reject(error);
        });

        this.child.on('spawn', () => {
          resolve();
        });
      });
    } catch (error) {
      logger(`Failed to run process: ${error.message}`);
    }
  }
}

export default Process;
