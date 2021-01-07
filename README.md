<p align="center"><img src="https://user-images.githubusercontent.com/69470382/100293903-809f2000-2f85-11eb-8481-912fd686c487.png"></p>

<p align="center">
<a href="https://github.com/electronfriends/wemp/releases"><img src="https://img.shields.io/github/downloads/electronfriends/wemp/total.svg" alt="Total Downloads"></a>
<a href="https://github.com/electronfriends/wemp/releases/latest"><img src="https://img.shields.io/github/v/release/electronfriends/wemp.svg" alt="Latest Stable Version"></a>
<a href="https://github.com/electronfriends/wemp/blob/master/LICENSE"><img src="https://img.shields.io/github/license/electronfriends/wemp.svg" alt="License"></a>
<a href="https://nginx.org" target="_blank"><img src="https://img.shields.io/badge/nginx-1.19.6-009639.svg"></a>
<a href="https://mariadb.org" target="_blank"><img src="https://img.shields.io/badge/mariadb-10.5.8-1f305f.svg"></a>
<a href="https://www.php.net" target="_blank"><img src="https://img.shields.io/badge/php-8.0.1-8892bf.svg"></a>
</p>

## About Wemp

Wemp is a simple menu for managing [Nginx](https://nginx.org), [MariaDB](https://mariadb.com) and [PHP](https://php.net) on Windows.

* **Nginx, MariaDB and PHP** form the basis for Wemp. With these pre-configured services, you can start developing your websites right away.

* **Automatic updates** ensure that you are always using the latest version of everything.

* **Fail-safe** thanks to notifications as soon as a service crashes. The service is restarted immediately by clicking on the notification.

<p align="center"><img src="https://user-images.githubusercontent.com/69470382/100527138-c7805600-31cf-11eb-999c-0ce5f317041c.png"></p>

## Installation

1. Download and run the latest Wemp installer from the [Releases](https://github.com/electronfriends/wemp/releases) page.

2. Select a directory in which the services should be installed. We will create a Wemp-folder there, so you don't need to do this yourself (e.g. selecting the `C:` drive would be `C:\Wemp`).

3. The services should now download. As soon as you see "Wemp is ready!", the services have started and you can access your website via `localhost`.

If you have a problem with the installation, please read the FAQs or [create an issue](https://github.com/electronfriends/wemp/issues).

## FAQs

### What does the "invalid signature" error mean?

This error occurs when the .zip file for a service no longer exists. This is often the case when a newer version is available, especially with PHP.

Please create an issue if you get this error message and we will update the versions.

## Contributing

Thank you for considering contributing to Wemp! This is our first Electron and GitHub project and we appreciate any support we can get.

Feel free to create pull requests or issues if you found a bug.

## License

Wemp is open-source software licensed under the [MIT License](https://github.com/electronfriends/wemp/blob/master/LICENSE).