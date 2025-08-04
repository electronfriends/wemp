import { ProcessManager } from '../lib/process-manager.js';
import { Service } from './base.js';

/**
 * Nginx web server service
 */
export class NginxService extends Service {
  /**
   * Create process manager for Nginx
   * @returns {ProcessManager} Process manager instance
   */
  createProcess() {
    return new ProcessManager(this.name, this.config.executable, ['-p', this.servicePath], {
      cwd: this.servicePath,
    });
  }
}
