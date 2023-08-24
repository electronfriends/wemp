import fs from 'fs';
import path from 'path';

import settings from 'electron-settings';
import fetch from 'node-fetch';
import unzipper from 'unzipper';

import config from '../config';

/**
 * Download and extract the service files.
 * @param {object} service - The service configuration.
 * @param {boolean} isUpdate - Whether it is an update or first installation.
 * @returns {Promise<void>}
 */
export default function download(service, isUpdate) {
  return new Promise(async (resolve, reject) => {
    const serviceName = service.name.toLowerCase();
    const servicePath = path.join(config.paths.services, serviceName);

    const response = await fetch(service.url.replace(/{version}/g, service.version));

    if (!response.ok) {
      reject(response.statusText);
    }

    response.body
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
      .on('error', async (error) => {
        // Older PHP versions must be downloaded from the archive.
        if (service.name === 'PHP' && error.message.includes('invalid signature')) {
          service.url = service.url.replace('releases/', 'releases/archives/');
          await download(service, isUpdate);
        } else {
          reject(error.message);
        }
      })
      .on('finish', () => {
        settings.setSync(serviceName, service.version);
        resolve();
      });
  });
}
