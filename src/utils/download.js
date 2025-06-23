import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import yauzl from 'yauzl';

import config from '../config';
import log from './logger';

const fromBuffer = promisify(yauzl.fromBuffer);

/**
 * Try to download the service package, with PHP fallback support
 * @param {string} downloadUrl - The download URL template with {version} placeholder
 * @param {string} version - The version to download
 * @param {string} serviceName - The name of the service (used for PHP fallback)
 * @returns {Promise<Buffer>} The downloaded file as a buffer
 * @throws {Error} If the download fails
 */
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

/**
 * Extract files from ZIP, removing root folder if present
 * @param {yauzl.ZipFile} zipFile - The opened ZIP file
 * @param {string} servicePath - The destination path for extraction
 * @param {import('../config').ServiceConfig} serviceConfig - The service configuration
 * @param {boolean} isUpdate - Whether this is an update or fresh install
 * @returns {Promise<void>} Resolves when extraction is complete
 */
async function extractFiles(zipFile, servicePath, serviceConfig, isUpdate) {
  return new Promise((resolve, reject) => {
    const extractionPromises = [];
    let rootFolder = '';
    let isFirstEntry = true;

    zipFile.on('entry', (entry) => {
      // Detect root folder from first entry
      if (isFirstEntry) {
        const pathParts = entry.fileName.split('/');
        rootFolder = pathParts.length > 1 ? pathParts[0] + '/' : '';
        isFirstEntry = false;
      }

      // Remove root folder from path if it exists
      const fileName = rootFolder && entry.fileName.startsWith(rootFolder)
        ? entry.fileName.substring(rootFolder.length)
        : entry.fileName;

      // Skip empty filenames
      if (!fileName) {
        zipFile.readEntry();
        return;
      }

      // Skip config files and ignored files during updates
      if (fileName === serviceConfig.config ||
          (isUpdate && serviceConfig.ignore?.some(pattern => fileName.includes(pattern)))) {
        zipFile.readEntry();
        return;
      }

      const destPath = path.join(servicePath, fileName);
      const isDirectory = fileName.endsWith('/');

      if (isDirectory) {
        fs.mkdirSync(destPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        extractionPromises.push(extractFile(zipFile, entry, destPath));
      }

      zipFile.readEntry();
    });

    zipFile.on('error', reject);
    zipFile.on('end', () => {
      Promise.all(extractionPromises)
        .then(resolve)
        .catch(reject);
    });

    zipFile.readEntry();
  });
}

/**
 * Extract a single file from the ZIP archive
 * @param {yauzl.ZipFile} zipFile - The opened ZIP file
 * @param {yauzl.Entry} entry - The ZIP entry to extract
 * @param {string} destPath - The destination file path
 * @returns {Promise<void>} Resolves when file extraction is complete
 */
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
  const servicePath = path.join(config.paths.services, service.id);

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
