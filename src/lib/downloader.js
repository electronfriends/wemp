import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import config from '../config.js';
import logger from './logger.js';

/**
 * Downloads, extracts, and configures a service package
 * @param {Object} service - Service configuration
 * @param {string} service.id - Service identifier
 * @param {string} service.name - Service display name
 * @param {string} service.version - Version to download
 * @param {string} service.downloadUrl - Download URL
 * @returns {Promise<void>}
 * @throws {Error} If download, extraction, or configuration fails
 */
export async function downloadService(service) {
  const servicePath = path.join(config.paths.services, service.id);
  const isFirstInstall = !fs.existsSync(servicePath);
  const tempPath = path.join(
    os.tmpdir(),
    `wemp-${service.id}-${crypto.randomBytes(8).toString('hex')}`
  );

  try {
    fs.mkdirSync(tempPath, { recursive: true });

    // Download package
    const buffer = await fetchPackage(service);

    // Extract to temp directory
    await extractZipBuffer(buffer, tempPath);

    // Flatten extraction if ZIP contains a single root folder
    flattenExtraction(tempPath);

    // Verify critical service files exist after extraction
    verifyServiceFiles(tempPath, service);

    // Only modify configs on first install to preserve user changes
    if (isFirstInstall) {
      await modifyServiceConfigs(service, tempPath, servicePath);
    }

    // Move verified files to final location (atomic update)
    installExtractedFiles(tempPath, servicePath, service);

    logger.info(`Downloaded and extracted ${service.name} ${service.version}`);
  } catch (error) {
    logger.error(`Failed to download ${service.name}`, error);
    throw error;
  } finally {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { recursive: true, force: true });
  }
}

/**
 * Downloads service package from remote URL
 * @param {Object} service - Service configuration with downloadUrl
 * @returns {Promise<Buffer>} Package data as buffer
 * @throws {Error} If download fails
 * @private
 */
async function fetchPackage(service) {
  let response = await fetch(service.downloadUrl);

  // PHP fallback: if download fails, try archives folder
  if (!response.ok && service.id.startsWith('php')) {
    const archiveUrl = service.downloadUrl.replace('releases/', 'releases/archives/');
    logger.warn(`PHP download failed, trying archive: ${archiveUrl}`);
    response = await fetch(archiveUrl);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    logger.info(
      `Downloading ${service.name}: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Extracts ZIP archive using PowerShell Expand-Archive cmdlet
 * @param {Buffer} buffer - ZIP file data
 * @param {string} servicePath - Target extraction path
 * @returns {Promise<void>}
 * @throws {Error} If extraction fails
 * @private
 */
async function extractZipBuffer(buffer, servicePath) {
  const tempZipPath = path.join(servicePath, 'temp.zip');

  try {
    fs.writeFileSync(tempZipPath, buffer);

    // Use PowerShell to extract ZIP with error capture
    await new Promise((resolve, reject) => {
      const powershell = spawn(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -Path "${tempZipPath}" -DestinationPath "${servicePath}" -Force`,
        ],
        { stdio: 'pipe', windowsHide: true }
      );

      let stderr = '';
      let stdout = '';
      powershell.stderr?.on('data', data => {
        stderr += data.toString();
      });
      powershell.stdout?.on('data', data => {
        stdout += data.toString();
      });

      powershell.on('exit', code => {
        if (code === 0) {
          resolve();
        } else {
          const errorMsg = stderr || stdout || `PowerShell extraction failed with code ${code}`;
          reject(new Error(errorMsg));
        }
      });
      powershell.on('error', reject);
    });
  } finally {
    // Clean up temp ZIP file
    if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
  }
}

/**
 * Flattens extraction by moving contents of single root folder up one level
 * @param {string} tempPath - Temporary extraction path
 * @private
 */
function flattenExtraction(tempPath) {
  const entries = fs.readdirSync(tempPath);

  // Check if extraction created a single root folder
  if (entries.length === 1) {
    const rootFolder = path.join(tempPath, entries[0]);
    const stats = fs.statSync(rootFolder);

    if (stats.isDirectory()) {
      const rootFolderName = entries[0];
      const tempRoot = path.join(tempPath, `_${rootFolderName}_temp`);

      // Rename root folder to temp name to avoid conflicts
      fs.renameSync(rootFolder, tempRoot);

      // Move all contents from temp folder to parent
      for (const item of fs.readdirSync(tempRoot)) {
        fs.renameSync(path.join(tempRoot, item), path.join(tempPath, item));
      }

      // Remove now-empty temp folder
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

/**
 * Verifies that critical service files exist after extraction
 * @param {string} tempPath - Temporary extraction path
 * @param {Object} service - Service configuration
 * @throws {Error} If required files are missing
 * @private
 */
function verifyServiceFiles(tempPath, service) {
  const baseServiceId = service.id.split('-')[0];
  const serviceConfig = config.services[baseServiceId];
  if (!serviceConfig) return;

  // Skip verification for services without executables (e.g., phpMyAdmin)
  if (!serviceConfig.executable) return;

  // Build path to executable
  const executablePath = serviceConfig.executablePath
    ? path.join(tempPath, serviceConfig.executablePath, serviceConfig.executable)
    : path.join(tempPath, serviceConfig.executable);

  if (!fs.existsSync(executablePath)) {
    throw new Error(
      `Critical file missing after extraction: ${serviceConfig.executable}. ` +
        `The download may be corrupted or incomplete.`
    );
  }

  logger.info(`Verified ${service.name} executable exists: ${serviceConfig.executable}`);
}

/**
 * Moves extracted files from temp location to service directory
 * @param {string} tempPath - Temporary extraction path
 * @param {string} servicePath - Final service installation path
 * @param {Object} service - Service configuration
 * @private
 */
function installExtractedFiles(tempPath, servicePath, service) {
  fs.mkdirSync(servicePath, { recursive: true });

  for (const item of fs.readdirSync(tempPath)) {
    const destPath = path.join(servicePath, item);

    // Skip overwriting user-modified files (configs, data directories, etc.)
    if (shouldPreserveFile(item, service) && fs.existsSync(destPath)) {
      logger.info(`Preserving existing ${service.name} file: ${item}`);
      continue;
    }

    // Replace existing files with new version
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true, force: true });
    }

    fs.renameSync(path.join(tempPath, item), destPath);
  }
}

/**
 * Determines if a file should be preserved during service updates
 * @param {string} fileName - Name of file or directory
 * @param {Object} service - Service configuration
 * @param {string} [service.configFile] - Configuration file path
 * @param {string[]} [service.preserve] - Patterns for files/dirs to preserve
 * @returns {boolean} True if file should be preserved
 * @private
 */
function shouldPreserveFile(fileName, service) {
  // Always preserve config files
  if (service.configFile && fileName === service.configFile) {
    return true;
  }

  // Check explicit preserve patterns
  return service.preserve?.some(pattern => {
    const dirName = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
    return pattern.endsWith('/')
      ? fileName === dirName || fileName.startsWith(pattern)
      : fileName === pattern;
  });
}

// Map of service IDs to their config modifier functions
const configModifiers = {
  nginx: modifyNginxConfig,
  php: modifyPhpConfig,
  phpmyadmin: modifyPhpMyAdminConfig,
};

/**
 * Applies service-specific configuration modifications
 * @param {Object} service - Service configuration
 * @param {string} tempPath - Temporary extraction path where files currently are
 * @param {string} finalPath - Final installation path for absolute path references in configs
 * @private
 */
async function modifyServiceConfigs(service, tempPath, finalPath) {
  const baseServiceId = service.id.split('-')[0];
  const modifier = configModifiers[baseServiceId];
  if (!modifier) return;

  if (baseServiceId === 'php') {
    await modifier(tempPath, finalPath);
  } else {
    await modifier(tempPath);
  }
}

/**
 * Configures nginx.conf for PHP and phpMyAdmin integration
 * @param {string} tempPath - Temporary directory where nginx files are
 * @private
 */
function modifyNginxConfig(tempPath) {
  const configPath = path.join(tempPath, 'conf', 'nginx.conf');
  if (!fs.existsSync(configPath)) return;

  let configContent = fs.readFileSync(configPath, 'utf8');

  // Uncomment the PHP FastCGI location block
  const phpBlockRegex = /#\s*location ~ \\\.php\$ \{[^}]*fastcgi_pass[^}]*\}/s;
  const phpBlockMatch = configContent.match(phpBlockRegex);

  if (phpBlockMatch) {
    const commentedBlock = phpBlockMatch[0];
    // Remove leading # from each line to enable PHP support
    const uncommentedBlock = commentedBlock
      .split('\n')
      .map(line => line.replace(/^(\s*)#/, '$1'))
      .join('\n');
    configContent = configContent.replace(commentedBlock, uncommentedBlock);

    // Correct the default path to use document root instead of hardcoded /scripts
    configContent = configContent.replace(
      /fastcgi_param\s+SCRIPT_FILENAME\s+\/scripts\$fastcgi_script_name;/,
      'fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;'
    );
  }

  // Enable directory listing
  configContent = configContent.replace(/(sendfile\s+on;)/, '$1\n    autoindex       on;');

  // Add index.php to the index directive in the main location / block
  configContent = configContent.replace(
    /(location\s+\/\s+\{[^}]*index\s+)(index\.html\s+index\.htm;)/s,
    '$1index.php $2'
  );

  // Add phpMyAdmin location block
  const phpMyAdminConfig = `
        # phpMyAdmin - makes http://localhost/phpmyadmin available
        location /phpmyadmin {
            alias ${config.paths.services.replace(/\\/g, '/')}/phpmyadmin;
            index index.php;

            location ~ \\.php$ {
                fastcgi_pass   127.0.0.1:9000;
                fastcgi_index  index.php;
                fastcgi_param  SCRIPT_FILENAME  $request_filename;
                include        fastcgi_params;
            }
        }
`;

  // Insert before the closing brace of the server block
  configContent = configContent.replace(
    /(server\s*\{[\s\S]*?)(^ {4}\}$)/m,
    `$1${phpMyAdminConfig}$2`
  );

  fs.writeFileSync(configPath, configContent);
}

/**
 * Configures PHP runtime settings and enables required extensions
 * @param {string} tempPath - Temporary directory where PHP files are
 * @param {string} finalPath - Final PHP installation directory for absolute paths in config
 * @private
 */
async function modifyPhpConfig(tempPath, finalPath) {
  const configPath = path.join(tempPath, 'php.ini');
  const devConfigPath = path.join(tempPath, 'php.ini-development');

  // Use development config as base
  if (fs.existsSync(devConfigPath) && !fs.existsSync(configPath)) {
    fs.copyFileSync(devConfigPath, configPath);
  }

  if (!fs.existsSync(configPath)) return;

  // Download SSL certificate bundle to temp directory
  await downloadCaCertificate(tempPath);

  let phpConfig = fs.readFileSync(configPath, 'utf8');

  // Set extension directory (required for Windows)
  if (!phpConfig.match(/^extension_dir\s*=\s*"ext"/m)) {
    phpConfig = phpConfig.replace(/^;?\s*extension_dir\s*=\s*"ext"/m, 'extension_dir = "ext"');
  }

  // Enable common extensions (uncomment extension=<name> lines)
  const extensions = [
    'curl',
    'fileinfo',
    'gd',
    'intl',
    'mbstring',
    'mysqli',
    'openssl',
    'pdo_mysql',
    'zip',
  ];

  for (const ext of extensions) {
    phpConfig = phpConfig.replace(new RegExp(`^;(extension=${ext})$`, 'gm'), '$1');
  }

  // Point SSL libraries to the CA bundle for HTTPS verification
  const certPath = path.join(finalPath, 'extras', 'ssl', 'cacert.pem').replace(/\\/g, '/');
  phpConfig = phpConfig.replace(/^;?\s*curl\.cainfo\s*=.*/m, `curl.cainfo = "${certPath}"`);
  phpConfig = phpConfig.replace(/^;?\s*openssl\.cafile\s*=.*/m, `openssl.cafile = "${certPath}"`);

  // Configure OPcache settings
  const opcacheSettings = [
    [/^;(zend_extension=opcache)$/gm, '$1'],
    [/^;(opcache\.enable\s*=\s*1)$/gm, '$1'],
    [/^;(opcache\.enable_cli\s*=\s*[01])$/gm, 'opcache.enable_cli=0'],
    [/^;(opcache\.validate_timestamps\s*=\s*1)$/gm, '$1'],
    [/^;(opcache\.revalidate_freq\s*=\s*\d+)$/gm, 'opcache.revalidate_freq=0'],
  ];

  for (const [pattern, replacement] of opcacheSettings) {
    phpConfig = phpConfig.replace(pattern, replacement);
  }

  // Configure resource limits
  phpConfig = phpConfig.replace(/^memory_limit\s*=\s*\d+M/m, 'memory_limit = 256M');
  phpConfig = phpConfig.replace(/^post_max_size\s*=\s*\d+M/m, 'post_max_size = 64M');
  phpConfig = phpConfig.replace(/^upload_max_filesize\s*=\s*\d+M/m, 'upload_max_filesize = 64M');

  fs.writeFileSync(configPath, phpConfig);
}

/**
 * Downloads CA certificate bundle for PHP SSL/TLS support
 * @param {string} servicePath - PHP installation directory
 * @private
 */
async function downloadCaCertificate(servicePath) {
  const sslDir = path.join(servicePath, 'extras', 'ssl');
  const certPath = path.join(sslDir, 'cacert.pem');

  // Skip if certificate already exists
  if (fs.existsSync(certPath)) return;

  fs.mkdirSync(sslDir, { recursive: true });

  try {
    logger.info('Downloading CA certificate bundle for PHP SSL support');
    const response = await fetch('https://curl.se/ca/cacert.pem');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const certData = await response.text();
    fs.writeFileSync(certPath, certData, 'utf8');
    logger.info('CA certificate bundle downloaded successfully');
  } catch (error) {
    logger.warn('Failed to download CA certificate bundle:', error.message);
    // Not critical - PHP will work without it, just no SSL verification
  }
}

/**
 * Configures phpMyAdmin for local MariaDB connection
 * @param {string} tempPath - Temporary directory where phpMyAdmin files are
 * @private
 */
function modifyPhpMyAdminConfig(tempPath) {
  const configPath = path.join(tempPath, 'config.inc.php');
  const sampleConfigPath = path.join(tempPath, 'config.sample.inc.php');

  if (fs.existsSync(sampleConfigPath) && !fs.existsSync(configPath)) {
    fs.copyFileSync(sampleConfigPath, configPath);
  }

  if (!fs.existsSync(configPath)) return;

  let config = fs.readFileSync(configPath, 'utf8');

  // Generate blowfish secret
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  const blowfishSecret = Array.from({ length: 32 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');

  // Configure for local development
  config = config.replace(
    /\$cfg\['blowfish_secret'\]\s*=\s*'[^']*'/,
    `$cfg['blowfish_secret'] = '${blowfishSecret}'`
  );
  config = config.replace(
    /\$cfg\['Servers'\]\[\$i\]\['auth_type'\]\s*=\s*'[^']*'/,
    "$cfg['Servers'][$i]['auth_type'] = 'config'"
  );
  config = config.replace(
    /\$cfg\['Servers'\]\[\$i\]\['AllowNoPassword'\]\s*=\s*[^;]*/,
    "$cfg['Servers'][$i]['AllowNoPassword'] = true"
  );

  // Set default root credentials
  if (!config.includes("['user']")) {
    config = config.replace(
      /(\$cfg\['Servers'\]\[\$i\]\['host'\][^;]*;)/,
      "$1\n$cfg['Servers'][$i]['user'] = 'root';\n$cfg['Servers'][$i]['password'] = '';"
    );
  }

  fs.writeFileSync(configPath, config);
}
