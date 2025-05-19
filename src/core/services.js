import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

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
    const servicePath = path.join(config.paths.services, this.id);
    return new Process(
      this.id,
      this.name,
      'nginx.exe',
      ['-p', servicePath],
      { cwd: servicePath }
    );
  }
}

class MariaDBService extends Service {
  createProcess() {
    const serviceBinPath = path.join(config.paths.services, this.id, 'bin');
    return new Process(
      this.id,
      this.name,
      'mysqld.exe',
      ['--defaults-file=../data/my.ini'],
      { cwd: serviceBinPath }
    );
  }

  /**
   * Initialize MariaDB database files
   */
  async install() {
    try {
      await execute('mysql_install_db.exe', {
        cwd: path.join(config.paths.services, this.id, 'bin')
      });
    } catch (error) {
      log.error(`Failed to install MariaDB: ${error.message}`);
    }
  }

  /**
   * Attempt graceful shutdown of MariaDB
   * Falls back to emergency shutdown if normal shutdown fails
   */
  async shutdown() {
    const serviceBinPath = path.join(config.paths.services, this.id, 'bin');
    for (let i = 0; i <= constants.retries.max; i++) {
      try {
        await execute('mysqladmin.exe -u root shutdown', {
          cwd: serviceBinPath
        });
        return;
      } catch (error) {
        if (i < constants.retries.max) {
          await new Promise(resolve => setTimeout(resolve, constants.retries.delay));
        } else {
          log.error(`Failed to gracefully shutdown MariaDB after ${i + 1} attempts. Attempting emergency shutdown.`);
        }
      }
    }

    // Emergency shutdown as fallback
    try {
      const emergencyProcess = spawn('mysqld.exe', ['--skip-grant-tables'], {
        cwd: serviceBinPath,
        stdio: 'pipe'
      });

      await new Promise((resolve, reject) => {
        const emergencyTimeout = setTimeout(() => {
          emergencyProcess.kill();
          reject(new Error('Emergency shutdown timed out'));
        }, constants.timeouts.STOP);

        emergencyProcess.on('spawn', async () => {
          try {
            // Attempt one more graceful shutdown now that the emergency process might have prepared it
            await execute('mysqladmin.exe -u root shutdown', {
              cwd: serviceBinPath
            });
            resolve();
          } catch (error) {
            reject(new Error(`Final shutdown attempt during emergency mode failed: ${error.message}`));
          } finally {
            clearTimeout(emergencyTimeout);
            emergencyProcess.kill();
          }
        });

        emergencyProcess.on('error', (err) => {
          clearTimeout(emergencyTimeout);
          reject(new Error(`MariaDB emergency process error: ${err.message}`));
        });
      });
    } catch (error) {
      log.error(`Emergency shutdown failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run database upgrade process
   */
  async upgrade() {
    try {
      await new Promise((resolve, reject) => {
        const upgradeProcess = spawn('mysql_upgrade.exe', ['-u', 'root'], {
          cwd: path.join(config.paths.services, this.id, 'bin'),
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
    } catch (error) {
      log.error(`Failed to upgrade MariaDB: ${error.message}`);
    }
  }

  /**
   * Start MariaDB and wait for it to be ready
   * @throws {Error} If startup fails or times out
   */
  async start() {
    await super.start();
    const startTime = Date.now();
    const serviceBinPath = path.join(config.paths.services, this.id, 'bin');

    while (Date.now() - startTime < constants.timeouts.START) {
      try {
        await execute('mysqladmin.exe -u root ping', {
          cwd: serviceBinPath
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
   * Falls back to force kill if graceful stop fails
   */
  async stop() {
    try {
      await this.shutdown();
    } catch (error) {
      await super.stop();
    } finally {
      this.process = null;
    }
  }
}

class PHPService extends Service {
  createProcess() {
    return new Process(
      this.id,
      this.name,
      'php-cgi.exe',
      ['-b', '127.0.0.1:9000'],
      {
        cwd: path.join(config.paths.services, this.id),
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
