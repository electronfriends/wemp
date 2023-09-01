import { exec, execFileSync, spawn } from 'child_process';

import BaseService from './base-service';

class MariaDB extends BaseService {
  constructor() {
    super('MariaDB', 'mariadbd.exe', [], 'bin');
  }

  async install() {
    return new Promise((resolve, reject) => {
      exec('mysql_install_db.exe', { cwd: this.cwd }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
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
