import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { ProcessManager } from '../lib/process-manager.js';
import { Service } from './base.js';

const execute = promisify(exec);

/**
 * MariaDB database service
 */
export class MariaDBService extends Service {
  /**
   * @param {Object} serviceConfig - Service configuration
   */
  constructor(serviceConfig) {
    super(serviceConfig);
    this.binPath = path.join(this.servicePath, this.config.executablePath);
    this.needsUpgrade = false;
  }

  /**
   * Create process manager for MariaDB
   * @returns {ProcessManager} Process manager instance
   */
  createProcess() {
    return new ProcessManager(this.name, this.config.executable, [], {
      cwd: this.binPath,
    });
  }

  /**
   * Start MariaDB service and handle upgrade if needed
   * @returns {Promise<void>}
   */
  async start() {
    await super.start();

    if (this.needsUpgrade) {
      await this.upgrade();
      this.needsUpgrade = false;
    }
  }

  /**
   * Install MariaDB database files
   * @returns {Promise<void>}
   * @throws {Error} If installation fails
   */
  async install() {
    try {
      await execute('mysql_install_db.exe', {
        cwd: this.binPath,
        windowsHide: true,
      });
    } catch (error) {
      throw new Error(`MariaDB installation failed: ${error.message}`);
    }
  }

  /**
   * Upgrade MariaDB database - must be called after service is running
   * @returns {Promise<void>}
   * @throws {Error} If upgrade fails
   */
  async upgrade() {
    if (!this.isRunning()) {
      throw new Error('MariaDB service must be running before upgrading');
    }

    try {
      await execute('mysql_upgrade.exe -u root', {
        cwd: this.binPath,
        windowsHide: true,
      });
    } catch (error) {
      throw new Error(`MariaDB upgrade failed: ${error.message}`);
    }
  }

  /**
   * Gracefully stop MariaDB
   * @returns {Promise<void>}
   * @throws {Error} If shutdown fails
   */
  async gracefulStop() {
    await execute('mysqladmin.exe -u root shutdown', {
      cwd: this.binPath,
      windowsHide: true,
    });
  }

  /**
   * Check if MariaDB is ready to accept connections
   * @returns {Promise<boolean>} True if ready
   */
  async checkReady() {
    try {
      await execute('mysqladmin.exe -u root ping', {
        cwd: this.binPath,
        windowsHide: true,
      });
      return true;
    } catch {
      return false;
    }
  }
}
