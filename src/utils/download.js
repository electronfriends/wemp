import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import yauzl from 'yauzl';

import config from '../config';
import log from './logger';

const fromBuffer = promisify(yauzl.fromBuffer);

// Try to download the service package, with PHP fallback support
async function fetchServicePackage(downloadUrl, version, serviceName) {
  const url = downloadUrl.replace(/{version}/g, version);
  let response = await fetch(url);

  if (!response.ok && serviceName === 'php') {
    const fallbackUrl = url.replace('releases/', 'releases/archives/');
    response = await fetch(fallbackUrl);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

// Extract files from ZIP, removing root folder if present
async function extractFiles(zipFile, servicePath, serviceConfig, isUpdate) {
  return new Promise((resolve, reject) => {
    const extractionPromises = [];
    let rootFolder = '';
    let isFirstEntry = true;

    zipFile.on('entry', (entry) => {
      // Detect root folder from first entry
      if (isFirstEntry) {
        const parts = entry.fileName.split('/');
        rootFolder = parts.length > 1 ? parts[0] + '/' : '';
        isFirstEntry = false;
      }

      // Remove root folder from path if it exists
      const fileName = rootFolder && entry.fileName.startsWith(rootFolder)
        ? entry.fileName.substring(rootFolder.length)
        : entry.fileName;

      const destPath = path.join(servicePath, fileName);

      // Skip config files and ignored files during updates
      if (fileName === serviceConfig.config ||
          (isUpdate && serviceConfig.ignore?.some(n => fileName.includes(n)))) {
        zipFile.readEntry();
        return;
      }

      // Create directory or extract file
      if (/\/$/.test(fileName)) {
        fs.mkdirSync(destPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        extractionPromises.push(
          extractFile(zipFile, entry, destPath)
            .catch(error => log.error(`Failed to extract ${fileName}`, error))
        );
      }

      zipFile.readEntry();
    });

    zipFile.on('error', reject);
    zipFile.on('end', () => Promise.all(extractionPromises).then(resolve).catch(reject));
    zipFile.readEntry();
  });
}

// Extract a single file from the ZIP archive
function extractFile(zipFile, entry, destPath) {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (err, readStream) => {
      if (err) return reject(err);

      const writeStream = fs.createWriteStream(destPath);
      readStream
        .pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);

      readStream.on('error', reject);
    });
  });
}

/**
 * Download and extract a service package
 * @param {import('../config').ServiceConfig} service
 * @param {boolean} isUpdate - Whether this is an update or fresh install
 */
export default async function download(service, isUpdate) {
  const servicePath = `${config.paths.services}/${service.id}`;

  try {
    fs.mkdirSync(servicePath, { recursive: true });
    const buffer = await fetchServicePackage(service.downloadUrl, service.version, service.id);
    const zipFile = await fromBuffer(buffer, { lazyEntries: true });
    await extractFiles(zipFile, servicePath, service, isUpdate);
  } catch (error) {
    log.error(`Failed to download ${service.id}`, error);
    throw error;
  }
}
