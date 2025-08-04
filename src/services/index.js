import { NginxService } from './nginx.js';
import { MariaDBService } from './mariadb.js';
import { PHPService } from './php.js';

const services = {
  nginx: NginxService,
  mariadb: MariaDBService,
  php: PHPService,
};

/**
 * Create a service instance based on configuration
 * @param {Object} config - Service configuration
 * @returns {Service} Service instance
 * @throws {Error} If service type is unknown
 */
export function createService(config) {
  const ServiceClass = services[config.id];
  if (!ServiceClass) {
    throw new Error(`Unknown service: ${config.id}`);
  }
  return new ServiceClass(config);
}
