<p align="center"><img src="https://user-images.githubusercontent.com/69470382/125867402-6a8af134-1e03-4d98-b1df-c347a2849c4e.png"></p>

<p align="center">
<a href="https://github.com/electronfriends/wemp/releases/latest"><img src="https://img.shields.io/github/v/release/electronfriends/wemp.svg?style=flat-square" alt="Latest Stable Version"></a>
<a href="https://github.com/electronfriends/wemp/releases"><img src="https://img.shields.io/github/downloads/electronfriends/wemp/total.svg?style=flat-square" alt="Total Downloads"></a>
<a href="https://github.com/electronfriends/wemp/issues"><img src="https://img.shields.io/github/issues/electronfriends/wemp.svg?style=flat-square" alt="GitHub Issues"></a>
<a href="LICENSE"><img src="https://img.shields.io/github/license/electronfriends/wemp.svg?style=flat-square" alt="License"></a>
</p>

## Introduction

Wemp is a simple menu in the notification area that allows you to easily set up and manage [Nginx](https://nginx.org), [MariaDB](https://mariadb.org) and [PHP](https://php.net) on Windows.

The goal of this project is to always offer the latest versions of the services.

<p align="center"><img src="https://user-images.githubusercontent.com/69470382/175114646-8e966bbb-7938-4895-bebd-db943cc5079b.png" alt="Wemp preview"></p>

## Features

- **Easy to use** for both experienced and inexperienced users.

- **Regular updates** to always offer the latest versions of all services.

- **Database management** powered by [phpMyAdmin](https://www.phpmyadmin.net), a popular web interface.

- **Monitoring** of configuration files to automatically restart services when changes are made.

- **Error logging** in a session-based log file so you can quickly track down errors.

- **Autostart** to start Wemp directly at startup. Easy to configure.

## Installation

1. Download and run the latest Wemp setup from the [Releases](https://github.com/electronfriends/wemp/releases/latest) page.

2. Choose the installation path for the services (the default is `C:\Wemp`).

3. Once everything is downloaded, you will be notified and the services will start automatically.

4. You can now get started at http://localhost and set up your database at http://localhost/phpmyadmin.

If you need help with something, [create a new issue](https://github.com/electronfriends/wemp/issues/new) and we'll be happy to help.

## FAQs

### Will the services be deleted if I uninstall Wemp?

No. The services are installed independently of Wemp and remain untouched when Wemp is uninstalled.

## Thanks to

- [Electron](https://www.electronjs.org) for the tools to create a Windows application with JavaScript.

- [Nginx](https://nginx.org), [MariaDB](https://mariadb.org), [PHP](https://php.net) and [phpMyAdmin](https://www.phpmyadmin.net) for providing their services.

- [Icons8.com](https://icons8.com) for the free [Fluency](https://icons8.com/icon/set/logs/fluency) icons that we use in our menu.

## Contributing

Thank you for your interest in contributing to Wemp.

If you find a bug or have a suggestion for a new feature, either [create a new issue](https://github.com/electronfriends/wemp/issues/new) or make a pull request.

## License

Wemp is open-source software licensed under the [MIT License](LICENSE).
