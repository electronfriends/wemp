import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import config, { constants } from '../config';
import Process from '../utils/process';
import log from '../utils/logger';

const execute = promisify(exec);

class Service {
  /**
   * Create a new service instance
   * @param {import('../config').ServiceConfig} serviceConfig - Service configuration
   */
  constructor(serviceConfig) {
    this.id = serviceConfig.id;
    this.name = serviceConfig.name;
    this.process = null;
  }

  /**
   * Start the service
   * @throws {Error} If service fails to start
   */
  async start() {
    if (!this.process) {
      this.process = this.createProcess();
    }
    await this.process.run();
  }

  /**
   * Stop the service
   * @throws {Error} If service fails to stop
   */
  async stop() {
    try {
      await this.process?.kill();
    } finally {
      this.process = null;
    }
  }

  /**
   * Create the service process
   * @returns {Process} Process instance
   * @throws {Error} Must be implemented by subclass
   */
  createProcess() {
    throw new Error('Service must implement createProcess');
  }
}

class NginxService extends Service {
  createProcess() {
    return new Process(
      this.name,
      'nginx.exe',
      ['-p', `${config.paths.services}/${this.id}`],
      { cwd: `${config.paths.services}/${this.id}` }
    );
  }
}

class MariaDBService extends Service {
  createProcess() {
    return new Process(
      this.name,
      'mysqld.exe',
      ['--defaults-file=../data/my.ini'],
      { cwd: `${config.paths.services}/${this.id}/bin` }
    );
  }

  /**
   * Initialize MariaDB database files
   * @throws {Error} If installation fails
   */
  async install() {
    try {
      await execute('mysql_install_db.exe', {
        cwd: `${config.paths.services}/${this.id}/bin`
      });
    } catch (error) {
      throw new Error(`Failed to install MariaDB: ${error.message}`);
    }
  }

  /**
   * Attempt graceful shutdown of MariaDB
   * @throws {Error} If both normal and emergency shutdown fail
   */
  async shutdown() {
    let retryCount = 0;

    const tryShutdown = async () => {
      try {
        await execute('mysqladmin.exe -u root shutdown', {
          cwd: `${config.paths.services}/${this.id}/bin`
        });
        return true;
      } catch (error) {
        if (retryCount >= constants.retries.max) {
          throw new Error(`Failed to shutdown MariaDB after ${constants.retries.max} attempts`);
        }
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, constants.retries.delay));
        return false;
      }
    };

    try {
      const success = await tryShutdown();
      if (success) return;
    } catch (error) {
      log.warn('Normal shutdown failed, attempting emergency shutdown', error);
    }

    // Emergency shutdown as fallback
    try {
      const emergencyProcess = spawn('mysqld.exe', ['--skip-grant-tables'], {
        cwd: `${config.paths.services}/${this.id}/bin`,
        stdio: 'pipe'
      });

      await new Promise((resolve, reject) => {
        emergencyProcess.on('spawn', async () => {
          try {
            await tryShutdown();
            resolve();
          } catch (error) {
            reject(error);
          } finally {
            emergencyProcess.kill();
          }
        });

        emergencyProcess.on('error', reject);
        setTimeout(() => {
          emergencyProcess.kill();
          reject(new Error('Emergency shutdown timed out'));
        }, constants.timeouts.STOP);
      });
    } catch (error) {
      throw new Error(`Emergency shutdown failed: ${error.message}`);
    }
  }

  /**
   * Run database upgrade process
   * @throws {Error} If upgrade fails or times out
   */
  async upgrade() {
    return new Promise((resolve, reject) => {
      const upgradeProcess = spawn('mysql_upgrade.exe', ['-u', 'root'], {
        cwd: `${config.paths.services}/${this.id}/bin`,
        stdio: 'pipe'
      });

      const timeout = setTimeout(() => {
        upgradeProcess.kill();
        reject(new Error('Upgrade timed out'));
      }, constants.timeouts.UPGRADE);

      upgradeProcess.on('close', code => {
        clearTimeout(timeout);
        code === 0 ? resolve() : reject(new Error(`Upgrade failed with code ${code}`));
      });

      upgradeProcess.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Start MariaDB and wait for it to be ready
   * @throws {Error} If startup fails or times out
   */
  async start() {
    await super.start();
    const startTime = Date.now();

    while (Date.now() - startTime < constants.timeouts.START) {
      try {
        await execute('mysqladmin.exe -u root ping', {
          cwd: `${config.paths.services}/${this.id}/bin`
        });
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, constants.retries.interval));
      }
    }
    throw new Error('MariaDB failed to start within the timeout period');
  }

  /**
   * Stop MariaDB gracefully
   * @throws {Error} If both graceful and force stop fail
   */
  async stop() {
    try {
      await this.shutdown();
    } catch (error) {
      log.error('Error during MariaDB shutdown', error);
      await super.stop();
    }
  }
}

class PHPService extends Service {
  createProcess() {
    return new Process(
      this.name,
      'php-cgi.exe',
      ['-b', '127.0.0.1:9000'],
      {
        cwd: `${config.paths.services}/${this.id}`,
        env: {
          ...process.env,
          PHP_FCGI_MAX_REQUESTS: '0'
        }
      }
    );
  }
}

/**
 * Create a new service instance
 * @param {import('../config').ServiceConfig} serviceConfig
 * @returns {Service} Service instance
 * @throws {Error} If service type is unknown
 */
export function createService(serviceConfig) {
  const serviceMap = {
    nginx: NginxService,
    mariadb: MariaDBService,
    php: PHPService
  };

  const ServiceClass = serviceMap[serviceConfig.id];
  if (!ServiceClass) {
    throw new Error(`Unknown service type: ${serviceConfig.name}`);
  }

  return new ServiceClass(serviceConfig);
}
