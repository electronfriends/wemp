import fs from 'node:fs';
import { promisify } from 'node:util';

import fetch from 'node-fetch';
import yauzl from 'yauzl';

import config from '../config';

const fromBuffer = promisify(yauzl.fromBuffer);

/**
 * Download and extract the service files.
 * @param {object} service - The service configuration.
 * @param {boolean} isUpdate - Whether it is an update or first installation.
 * @returns {Promise<void>}
 */
export default async function download(service, isUpdate) {
  try {
    const serviceName = service.name.toLowerCase();
    const servicePath = `${config.paths.services}/${serviceName}`;

    if (!fs.existsSync(servicePath)) {
      fs.mkdirSync(servicePath, { recursive: true });
    }

    let response = await fetch(service.downloadUrl.replace(/{version}/g, service.version));

    if (!response.ok && service.name === 'PHP') {
      // Fallback for PHP: Older versions must be downloaded from the archives.
      const fallbackUrl = service.downloadUrl.replace('releases/', 'releases/archives/');
      response = await fetch(fallbackUrl.replace(/{version}/g, service.version));
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const zipfile = await fromBuffer(buffer, { lazyEntries: true });

    return new Promise((resolve, reject) => {
      const extractionPromises = [];

      zipfile.on('error', reject);

      zipfile.on('entry', async (entry) => {
        let fileName = entry.fileName;

        // All services except PHP have their files inside a root directory in the ZIP.
        // For example: "nginx-1.27.3/nginx.exe" -> "nginx.exe"
        if (service.name !== 'PHP') {
          fileName = fileName.substr(fileName.indexOf('/') + 1);
        }

        const isConfigFile = fileName === service.config;
        const isIgnored = isUpdate && service.ignore?.some(n => fileName.includes(n));

        if (isConfigFile || isIgnored) {
          zipfile.readEntry();
          return;
        }

        const fileDestPath = `${servicePath}/${fileName}`;

        if (/\/$/.test(entry.fileName)) {
          fs.mkdirSync(fileDestPath, { recursive: true });
          zipfile.readEntry();
        } else {
          const extractPromise = new Promise((resolveExtract, rejectExtract) => {
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                rejectExtract(err);
                return;
              }

              const writeStream = fs.createWriteStream(fileDestPath);
              readStream.pipe(writeStream);

              writeStream.on('finish', resolveExtract);
              writeStream.on('error', rejectExtract);
              readStream.on('error', rejectExtract);
            });
          });

          extractionPromises.push(extractPromise);
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        Promise.all(extractionPromises)
          .then(resolve)
          .catch(reject);
      });

      zipfile.readEntry();
    });
  } catch (error) {
    throw error; // Let the caller handle the error
  }
}
