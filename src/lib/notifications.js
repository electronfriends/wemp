import { Notification } from 'electron';

/**
 * Shows service error notification
 * @param {string} serviceName - Name of the service
 * @param {string} error - Error message
 */
export function showServiceError(serviceName, error) {
  new Notification({
    title: 'Service Error',
    body: `${serviceName}: ${error}`,
  }).show();
}

/**
 * Shows service crashed notification
 * @param {string} serviceName - Name of the service
 */
export function showServiceCrashed(serviceName) {
  new Notification({
    title: 'Service Crashed',
    body: `${serviceName} has stopped unexpectedly`,
  }).show();
}

/**
 * Shows service installing notification
 * @param {string} serviceName - Name of the service
 * @param {string} version - Version being installed
 * @returns {Notification} Notification object for manual dismissal
 */
export function showServiceInstalling(serviceName, version) {
  const notification = new Notification({
    title: `Installing ${serviceName} ${version}`,
    body: 'Downloading, extracting, and configuring. This may take a moment...',
    silent: true,
    timeoutType: 'never',
  });
  notification.show();
  return notification;
}

/**
 * Shows service installation failed notification
 * @param {string} serviceName - Name of the service
 * @param {string} error - Error message
 */
export function showInstallFailed(serviceName, error) {
  new Notification({
    title: `Failed to Install ${serviceName}`,
    body: error,
  }).show();
}

/**
 * Shows service update failed notification
 * @param {string} serviceName - Name of the service
 * @param {string} error - Error message
 */
export function showUpdateFailed(serviceName, error) {
  new Notification({
    title: `Failed to Update ${serviceName}`,
    body: error,
  }).show();
}

/**
 * Shows service updating notification
 * @param {string} serviceName - Name of the service
 * @param {string} version - Version being updated to
 * @returns {Notification} Notification object for manual dismissal
 */
export function showServiceUpdating(serviceName, version) {
  const notification = new Notification({
    title: `Updating ${serviceName} to ${version}`,
    body: 'Downloading and extracting. This may take a moment...',
    silent: true,
    timeoutType: 'never',
  });
  notification.show();
  return notification;
}
