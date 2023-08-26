import fs from 'fs';
import path from 'path';

import fetch from 'node-fetch';
import unzipper from 'unzipper';

import config from '../config';

/**
 * Download and extract the service files.
 * @param {object} service - The service configuration.
 * @param {boolean} isUpdate - Whether it is an update or first installation.
 * @returns {Promise<void>}
 */
export default async function download(service, isUpdate) {
  const serviceName = service.name.toLowerCase();
  const servicePath = path.join(config.paths.services, serviceName);

  if (!fs.existsSync(servicePath)) {
    fs.mkdirSync(servicePath, { recursive: true });
  }

  try {
    let response = await fetch(service.url.replace(/{version}/g, service.version));

    if (!response.ok && service.name === 'PHP') {
      // Fallback for PHP: Older versions must be downloaded from the archives.
      const fallbackUrl = service.url.replace('releases/', 'releases/archives/');
      response = await fetch(fallbackUrl.replace(/{version}/g, service.version));
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    await response.body
      .pipe(unzipper.Parse())
      .on('entry', async (entry) => {
        let fileName = entry.path;

        // Every service except PHP puts its content in a directory.
        if (service.name !== 'PHP') {
          fileName = fileName.substr(fileName.indexOf('/') + 1);
        }

        const isConfigFile = fileName === service.config;
        const isIgnored = isUpdate && service.ignore?.some(n => fileName.includes(n));

        if (isConfigFile || isIgnored) {
          entry.autodrain();
        } else {
          const fileDestPath = path.join(servicePath, fileName);

          if (entry.type === 'Directory') {
            fs.mkdirSync(fileDestPath, { recursive: true });
          } else if (entry.type === 'File') {
            entry.pipe(fs.createWriteStream(fileDestPath));
          }
        }
      })
      .promise();

    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}
