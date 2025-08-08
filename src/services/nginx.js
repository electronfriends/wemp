import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import { ProcessManager } from '../lib/process-manager.js';
import { Service } from './base.js';

const execute = promisify(exec);

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

  /**
   * Gracefully stop Nginx using its control signal
   */
  async gracefulStop() {
    await execute(`${this.config.executable} -s quit`, {
      cwd: this.servicePath,
      windowsHide: true,
    });
  }

  /**
   * Reload Nginx configuration without full restart
   */
  async reload() {
    await execute(`${this.config.executable} -s reload`, {
      cwd: this.servicePath,
      windowsHide: true,
    });
  }

  /**
   * Prefer reload over full restart; do not fallback here
   */
  async restart() {
    try {
      await this.reload();
    } catch {
      // Intentionally no fallback to full restart
    }
  }
}
