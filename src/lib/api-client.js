import config from '../config.js';
import logger from './logger.js';

/**
 * Retrieves latest service versions from remote API endpoint
 * @returns {Promise<Record<string, {version: string, downloadUrl: string}>|null>} Service versions object or null on failure
 */
export async function fetchServiceVersions() {
  const apiUrl = `${config.api.baseUrl}${config.api.endpoints.versions}`;

  try {
    logger.info(`Fetching service versions from ${apiUrl}`);
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(config.api.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid content type - expected JSON');
    }

    const versions = await response.json();
    if (!versions || typeof versions !== 'object') {
      throw new Error('Invalid response format - expected object');
    }

    const serviceKeys = Object.keys(versions);
    if (serviceKeys.length === 0) {
      throw new Error('No services found in API response');
    }

    return versions;
  } catch (error) {
    logger.error('Failed to fetch service versions', error);
    return null;
  }
}
