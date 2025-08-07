import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import yauzl from 'yauzl';

import config from '../config.js';
import logger from './logger.js';

const fromBuffer = promisify(yauzl.fromBuffer);

/**
 * Download and install/update a service
 * @param {Object} service - Service configuration object
 * @param {boolean} isUpdate - Whether this is an update (true) or fresh install (false)
 * @returns {Promise<void>}
 * @throws {Error} If download or extraction fails
 */
export async function downloadService(service, isUpdate = false) {
  const servicePath = path.join(config.paths.services, service.id);

  try {
    fs.mkdirSync(servicePath, { recursive: true });

    const buffer = await fetchPackage(service);
    const zipFile = await fromBuffer(buffer, { lazyEntries: true });
    await extractFiles(zipFile, servicePath, service, isUpdate);

    // Replace extracted config with our stub version for new installs
    if (!isUpdate) {
      await replaceWithStub(service, servicePath);
    }
  } catch (error) {
    logger.error(`Failed to ${isUpdate ? 'update' : 'install'} ${service.name}`, error);
    throw error;
  }
}

/**
 * Fetch service package from URL
 * @param {Object} service - Service configuration object
 * @returns {Promise<ArrayBuffer>} Package data
 * @throws {Error} If download fails
 */
async function fetchPackage(service) {
  const url = service.downloadUrl.replace(/{version}/g, service.version);

  let response = await fetch(url);

  // Handle PHP version archive fallback (releases sometimes moved to archives)
  if (!response.ok && service.id === 'php') {
    const fallbackUrl = url.replace('releases/', 'releases/archives/');
    response = await fetch(fallbackUrl);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Extract files from ZIP archive to service directory
 * @param {Object} zipFile - Yauzl zip file object
 * @param {string} servicePath - Destination path for extraction
 * @param {Object} service - Service configuration object
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Promise<void>}
 */
async function extractFiles(zipFile, servicePath, service, isUpdate) {
  return new Promise((resolve, reject) => {
    const extractionPromises = [];
    let rootFolder = '';
    let isFirstEntry = true;

    zipFile.on('entry', entry => {
      // Auto-detect and strip root folder from archive (common in downloaded packages)
      if (isFirstEntry) {
        const pathParts = entry.fileName.split('/');
        rootFolder = pathParts.length > 1 ? pathParts[0] + '/' : '';
        isFirstEntry = false;
      }

      // Remove root folder prefix to flatten the extraction
      const fileName =
        rootFolder && entry.fileName.startsWith(rootFolder)
          ? entry.fileName.substring(rootFolder.length)
          : entry.fileName;

      if (!fileName) {
        zipFile.readEntry();
        return;
      }

      const destPath = path.join(servicePath, fileName.replace(/\//g, path.sep));

      // Skip preserved files during updates
      if (shouldPreserveFile(fileName, service, isUpdate) && fs.existsSync(destPath)) {
        zipFile.readEntry();
        return;
      }

      if (fileName.endsWith('/')) {
        // Directory
        try {
          fs.mkdirSync(destPath, { recursive: true });
        } catch (error) {
          if (error.code !== 'EEXIST') {
            reject(error);
            return;
          }
        }
      } else {
        // File
        try {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          extractionPromises.push(extractFile(zipFile, entry, destPath));
        } catch (error) {
          reject(error);
          return;
        }
      }

      zipFile.readEntry();
    });

    zipFile.on('error', reject);
    zipFile.on('end', () => {
      Promise.all(extractionPromises).then(resolve).catch(reject);
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
      readStream.pipe(writeStream).on('finish', resolve).on('error', reject);

      readStream.on('error', reject);
    });
  });
}

/**
 * Replace extracted config file with our stub version if it exists
 * @param {Object} service - Service configuration
 * @param {string} servicePath - Path to service directory
 */
async function replaceWithStub(service, servicePath) {
  const stubPath = path.join(config.paths.stubs, service.id, service.configFile);
  const targetPath = path.join(servicePath, service.configFile);

  if (fs.existsSync(stubPath)) {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Read stub content and replace {servicesPath} placeholder
      let stubContent = fs.readFileSync(stubPath, 'utf8');
      stubContent = stubContent.replace(/{servicesPath}/g, config.paths.services);

      // Write the customized stub to target
      fs.writeFileSync(targetPath, stubContent);
    } catch (error) {
      logger.error(`Failed to replace config with stub for ${service.name}`, error);
    }
  }
}

/**
 * Check if a file should be preserved during update
 * @param {string} fileName - File name from zip
 * @param {Object} service - Service configuration
 * @param {boolean} isUpdate - Whether this is an update
 * @returns {boolean} True if file should be preserved (not extracted)
 */
function shouldPreserveFile(fileName, service, isUpdate) {
  if (!isUpdate) return false;

  // Preserve service-specific files/folders
  if (service.preserve) {
    for (const preservePath of service.preserve) {
      if (preservePath.endsWith('/') && fileName.startsWith(preservePath)) {
        return true;
      }
      if (fileName === preservePath || fileName.endsWith('/' + preservePath)) {
        return true;
      }
    }
  }

  return false;
}
