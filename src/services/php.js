import { ProcessManager } from '../lib/process-manager.js';
import { Service } from './base.js';

/**
 * PHP FastCGI service
 */
export class PHPService extends Service {
  /**
   * Create process manager for PHP FastCGI
   * @returns {ProcessManager} Process manager instance
   */
  createProcess() {
    return new ProcessManager(this.name, this.config.executable, ['-b', '127.0.0.1:9000'], {
      cwd: this.servicePath,
      env: {
        ...process.env,
        PHP_FCGI_MAX_REQUESTS: '0',
      },
    });
  }
}
