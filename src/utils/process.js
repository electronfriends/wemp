import { exec, spawn } from 'child_process';

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
            return;
          }
          resolve(stdout);
        });
      });

      return stdout.includes(this.executable);
    } catch (error) {
      logger(`Failed to check if process is running: ${error.message}`);
      return false;
    }
  }

  async kill() {
    this.child?.kill();

    await new Promise(resolve => {
      exec(`taskkill /F /IM "${this.executable}"`, () => resolve());
    });
  }

  async run(restartOnClose = false) {
    try {
      const isRunning = await this.isRunning();

      if (isRunning) {
        await this.kill();
      }

      await this.start(restartOnClose);
    } catch (error) {
      throw error;
    }
  }

  start(restartOnClose) {
    return new Promise((resolve, reject) => {
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
  }
}

export default Process;
