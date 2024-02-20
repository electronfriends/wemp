<p align="center"><img src="https://user-images.githubusercontent.com/69470382/125867402-6a8af134-1e03-4d98-b1df-c347a2849c4e.png"></p>

<p align="center">
<a href="https://github.com/electronfriends/wemp/releases/latest"><img src="https://img.shields.io/github/v/release/electronfriends/wemp.svg?style=flat-square" alt="Latest Stable Version"></a>
<a href="https://github.com/electronfriends/wemp/releases"><img src="https://img.shields.io/github/downloads/electronfriends/wemp/total.svg?style=flat-square" alt="Total Downloads"></a>
<a href="https://github.com/electronfriends/wemp/issues"><img src="https://img.shields.io/github/issues/electronfriends/wemp.svg?style=flat-square" alt="GitHub Issues"></a>
<a href="LICENSE"><img src="https://img.shields.io/github/license/electronfriends/wemp.svg?style=flat-square" alt="License"></a>
</p>

## Introduction

Wemp allows you to easily and quickly set up a web server on Windows with [Nginx](https://nginx.org), [MariaDB](https://mariadb.org) and [PHP](https://php.net).

It comes bundled with these services and receives regular updates to keep the versions up to date.

You can manage the services in the menu that opens when you click the Wemp icon in the system tray.

<p align="center"><img src="https://github.com/electronfriends/wemp/assets/69470382/ef05b121-1b4d-4a9e-aedd-35961e666d78" alt="Wemp preview"></p>

## Features

- **Easy to use** for both novice and experienced users.

- **Regular updates** to always offer the latest versions of all services.

- **Database management** powered by [phpMyAdmin](https://www.phpmyadmin.net), a popular web interface.

- **Monitoring** of configuration files to automatically restart services when changes are made.

- **Error logging** in a session-based log file so you can quickly track down errors.

- **Autostart** option in the menu to always start Wemp directly at startup.

## Installation

1. Download and run the latest Wemp setup from the [Releases](https://github.com/electronfriends/wemp/releases/latest) page.

2. Choose the installation path for the services (the default is `C:\Wemp`).

3. Once everything is downloaded, you will be notified and the services will start automatically.

4. You can now get started at http://localhost and set up your database at http://localhost/phpmyadmin.

If you need help with something, [create a new issue](https://github.com/electronfriends/wemp/issues/new) and we'll be happy to help.

## FAQs

### Will the services be deleted if I uninstall Wemp?

No. The services are installed separately from Wemp and are not deleted.

### Why does the autostart option get reset after every update?

This is due to Electron Forge and we have already opened an [issue](https://github.com/electron/forge/issues/3333) about this, but unfortunately there has been no response yet.

### Can I use a particular version of a service?

No. Wemp always uses the versions it has configured internally. But this is planned for the future.

## Thanks to

- [Electron](https://www.electronjs.org) for the tools to create a Windows application with JavaScript.

- [Nginx](https://nginx.org), [MariaDB](https://mariadb.org), [PHP](https://php.net) and [phpMyAdmin](https://www.phpmyadmin.net) for providing their services.

- [Icons8](https://icons8.com) for the free [Fluency](https://icons8.com/icons/fluency) icons that we use in our menu.

## Contributing

If you want to help us with the development of Wemp, e.g. by fixing a bug or introducing a new feature, feel free to [create a new issue](https://github.com/electronfriends/wemp/issues/new) or make a pull request.

We appreciate all the support we can get.

## License

Wemp is open-source software licensed under the [MIT License](LICENSE).
