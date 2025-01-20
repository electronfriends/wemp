import { Notification } from 'electron';

// Create and show a notification that closes on click
function createNotification(options) {
  const notification = new Notification(options);
  notification.on('click', () => notification.close());
  notification.show();
  return notification;
}

/**
 * Show notification for service download or update
 * @param {Object} service - Service configuration
 * @param {boolean} isUpdate - Whether this is an update
 */
export function onServiceDownload(service, isUpdate) {
  return createNotification({
    title: isUpdate
      ? `Updating ${service.name}`
      : `Downloading ${service.name}`,
    body: `${service.version} - Please wait and do not close the application.`,
    silent: true,
    timeoutType: 'never'
  });
}

/**
 * Show notification for failed service download
 * @param {string} name - Service display name
 */
export function onServiceDownloadError(name) {
  return createNotification({
    title: 'Download Failed',
    body: `Failed to download ${name}. Check the error logs for details.`
  });
}

/**
 * Show notification for service runtime error
 * @param {string} name - Service display name
 */
export function onServiceError(name) {
  return createNotification({
    title: 'Service Error',
    body: `${name} has stopped unexpectedly. Check the error logs for details.`
  });
}

/**
 * Show notification when all services are ready
 */
export function onServicesReady() {
  return createNotification({
    title: 'Services Are Running',
    body: 'Your web server environment is ready. Click the tray icon to manage services.',
    silent: true
  });
}
