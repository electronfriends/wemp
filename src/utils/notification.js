import { Notification } from 'electron/main';

/**
 * Show a notification when a service download or update begins.
 * @param {object} service - The service being downloaded or updated.
 * @param {boolean} isUpdate - Whether the service is being updated.
 * @returns {Notification} - The created Notification object.
 */
export function onServiceDownload(service, isUpdate) {
  const notification = new Notification({
    title: isUpdate
      ? `Updating ${service.name} to ${service.version}...`
      : `Downloading ${service.name} ${service.version}...`,
    body: 'This may take a while, please wait and do not close the application.',
    silent: true,
    timeoutType: 'never'
  });

  notification.on('click', () => notification.close());
  notification.show();

  return notification;
}

/**
 * Show a notification for a failed service download.
 * @param {string} name - The name of the service that failed to download.
 */
export function onServiceDownloadError(name) {
  const notification = new Notification({
    title: `${name} could not be downloaded!`,
    body: 'There was an error downloading the service. Please check the error logs for more information.',
    timeoutType: 'never'
  });

  notification.on('click', () => notification.close());
  notification.show();
}

/**
 * Show a notification for a stopped service with an error.
 * @param {string} name - The name of the service that encountered an error and stopped.
 */
export function onServiceError(name) {
  const notification = new Notification({
    title: `${name} has stopped working!`,
    body: 'The service stopped working unexpectedly. Please check the error logs for more information.'
  });

  notification.on('click', () => notification.close());
  notification.show();
}

/**
 * Show a notification when the services are ready.
 */
export function onServicesReady() {
  const notification = new Notification({
    title: 'Wemp is ready!',
    body: 'You can now manage the services from the menu that opens when you click on the Wemp icon in the notification area.',
    silent: true,
    timeoutType: 'never'
  });

  notification.on('click', () => notification.close());
  notification.show();
}
