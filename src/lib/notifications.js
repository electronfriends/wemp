import { Notification } from 'electron';

/**
 * Show notification when service starts installing/updating
 * @param {string} serviceName
 * @param {boolean} wasInstall
 * @param {string} version - Version being installed/updated to
 * @returns {Notification} Notification instance to close later
 */
export function showServiceInstallNotification(serviceName, wasInstall, version) {
  const title = wasInstall ? 'Installing Service' : 'Updating Service';
  const body = wasInstall
    ? `${serviceName} is being installed. This may take a few moments...`
    : `${serviceName} is being updated to ${version}...`;

  const notification = new Notification({
    title,
    body,
    silent: true,
    timeoutType: 'never',
  });

  notification.show();
  return notification;
}

/**
 * Show notification when service installation/update fails
 * @param {string} serviceName
 * @param {boolean} wasInstall
 */
export function showServiceErrorNotification(serviceName, wasInstall) {
  new Notification({
    title: 'Service Error',
    body: `Failed to ${wasInstall ? 'install' : 'update'} ${serviceName}`,
  }).show();
}

/**
 * Show notification when all services are ready (first run)
 */
export function showServicesReadyNotification() {
  new Notification({
    title: 'Services Ready!',
    body: 'All services have been installed and are running. You can manage them via the tray icon in your system tray.',
    silent: true,
  }).show();
}

/**
 * Show notification when a service crashes unexpectedly
 * @param {string} serviceName
 */
export function showServiceCrashedNotification(serviceName) {
  new Notification({
    title: 'Service Crashed',
    body: `${serviceName} has stopped unexpectedly. Check logs for details.`,
  }).show();
}

/**
 * Show notification when service restart fails
 * @param {string} serviceName
 * @param {string} errorMessage
 */
export function showRestartFailedNotification(serviceName, errorMessage) {
  new Notification({
    title: 'Restart Failed',
    body: `Failed to restart ${serviceName}: ${errorMessage}`,
  }).show();
}
