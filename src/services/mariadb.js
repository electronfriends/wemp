import { exec, execFileSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import BaseService from './base-service';

const execute = promisify(exec);

class MariaDB extends BaseService {
  constructor() {
    super('MariaDB', 'mariadbd.exe', [], 'bin');
  }

  async install() {
    try {
      await execute('mysql_install_db.exe', { cwd: this.cwd });
    } catch (error) {
      throw new Error(`Failed to install MySQL: ${error.message}`);
    }
  }

  async shutdown() {
    const maxRetries = 3;
    let retryCount = 0;

    return new Promise((resolve, reject) => {
      const attemptShutdown = () => {
        try {
          execFileSync('mysqladmin.exe', ['-u', 'root', 'shutdown'], { cwd: this.cwd });
          resolve();
        } catch (error) {
          if (retryCount === maxRetries) {
            reject(error);
          } else {
            retryCount++;
            setTimeout(attemptShutdown, 3000);
          }
        }
      };

      const childProcess = spawn(this.executable, ['--skip-grant-tables'], { cwd: this.cwd });

      childProcess.on('error', reject);
      childProcess.on('spawn', attemptShutdown);
    });
  }

  async upgrade() {
    return new Promise((resolve, reject) => {
      exec('mysql_upgrade.exe', { cwd: '' }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async start() {
    await super.start();

    if (this.needsUpgrade) {
      try {
        await this.upgrade();
        this.needsUpgrade = false;
      } catch (error) {
        logger(`Failed to upgrade MariaDB: ${error}`);
      }
    }
  }
}

export default MariaDB;
